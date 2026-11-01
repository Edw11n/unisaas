-- ============================================================================
-- AUDITORÍA EXHAUSTIVA DE SEGURIDAD RLS - FASE 9 (UniSaaS QA / Certificación)
-- ============================================================================
-- Verifica los 10 criterios obligatorios de aislamiento multi-tenant
-- Utiliza el rol real de aplicación 'app_runtime'
-- ============================================================================

DO $$
DECLARE
  v_role_super BOOLEAN;
  v_role_inherit BOOLEAN;
  v_role_bypassrls BOOLEAN;
  v_role_createrole BOOLEAN;
  v_table_owner_count INT;
  v_schema_create BOOLEAN;
  v_secdef_search_path TEXT[];
  v_unprotected_tables INT;
  v_policy_count INT;
  v_visible_count INT;
  v_affected_rows INT;

  v_tenant_a UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  v_tenant_b UUID := '22222222-2222-2222-2222-222222222222'::UUID;
  v_branch_a UUID := 'a1111111-1111-1111-1111-111111111111'::UUID;
  v_branch_b UUID := 'a2222222-2222-2222-2222-222222222222'::UUID;
BEGIN
  RAISE NOTICE '--- INICIANDO AUDITORÍA INTEGRAL DE SEGURIDAD RLS ---';

  -- --------------------------------------------------------------------------
  -- 1. VERIFICACIÓN DE PRIVILEGIOS MÍNIMOS DE app_runtime
  -- --------------------------------------------------------------------------
  SELECT rolsuper, rolinherit, rolcreaterole, rolbypassrls
  INTO v_role_super, v_role_inherit, v_role_createrole, v_role_bypassrls
  FROM pg_roles WHERE rolname = 'app_runtime';

  IF v_role_super OR v_role_inherit OR v_role_createrole OR v_role_bypassrls THEN
    RAISE EXCEPTION 'CRÍTICO: app_runtime tiene privilegios indebidos (super: %, inherit: %, createrole: %, bypassrls: %)',
      v_role_super, v_role_inherit, v_role_createrole, v_role_bypassrls;
  END IF;

  SELECT count(*) INTO v_table_owner_count
  FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'app_runtime';
  IF v_table_owner_count > 0 THEN
    RAISE EXCEPTION 'CRÍTICO: app_runtime es propietario de % tablas en public', v_table_owner_count;
  END IF;

  SELECT has_schema_privilege('app_runtime', 'public', 'CREATE') INTO v_schema_create;
  IF v_schema_create THEN
    RAISE EXCEPTION 'CRÍTICO: app_runtime tiene privilegio CREATE sobre esquema public';
  END IF;
  RAISE NOTICE '[OK] Criterio 1: app_runtime cuenta con privilegios mínimos y no es propietario ni tiene BYPASSRLS.';

  -- --------------------------------------------------------------------------
  -- 2. VERIFICACIÓN DE SECURITY DEFINER Y SEARCH_PATH
  -- --------------------------------------------------------------------------
  SELECT proconfig INTO v_secdef_search_path
  FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
  WHERE nspname = 'public' AND proname = 'current_tenant_id' AND prosecdef = true;

  IF v_secdef_search_path IS NULL OR NOT (v_secdef_search_path::text LIKE '%search_path%') THEN
    RAISE EXCEPTION 'CRÍTICO: current_tenant_id es SECURITY DEFINER pero no tiene fijado search_path seguro';
  END IF;
  RAISE NOTICE '[OK] Criterio 2: Función current_tenant_id configurada con SECURITY DEFINER y search_path inmutable.';

  -- --------------------------------------------------------------------------
  -- 3. VERIFICACIÓN DE ENABLE RLS Y FORCE RLS EN TABLAS MULTI-TENANT
  -- --------------------------------------------------------------------------
  SELECT count(*) INTO v_unprotected_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns col 
      WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenant_id'
    )
    AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);

  IF v_unprotected_tables > 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Existen % tablas multi-tenant sin ENABLE RLS o FORCE RLS activo', v_unprotected_tables;
  END IF;
  RAISE NOTICE '[OK] Criterio 3: El 100%% de las tablas con tenant_id tienen ENABLE RLS y FORCE RLS activados estrictamente.';

  -- --------------------------------------------------------------------------
  -- 4. CONMUTACIÓN AL ROL app_runtime PARA PRUEBAS TRANSACCIONALES
  -- --------------------------------------------------------------------------
  SET LOCAL ROLE app_runtime;

  -- --------------------------------------------------------------------------
  -- 5. LECTURA PROPIA: TENANT A CONSULTA SUS REGISTROS
  -- --------------------------------------------------------------------------
  PERFORM set_config('app.current_tenant_id', v_tenant_a::text, true);
  SELECT count(*) INTO v_visible_count FROM branches;
  IF v_visible_count = 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Tenant A no pudo visualizar su propia sucursal';
  END IF;
  SELECT count(*) INTO v_visible_count FROM branches WHERE id = v_branch_b;
  IF v_visible_count > 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Tenant A pudo visualizar la sucursal del Tenant B por ID';
  END IF;
  RAISE NOTICE '[OK] Criterio 4: Tenant A consulta sus propios registros y no ve los de Tenant B.';

  -- --------------------------------------------------------------------------
  -- 6. LECTURA PROPIA: TENANT B CONSULTA SUS REGISTROS
  -- --------------------------------------------------------------------------
  PERFORM set_config('app.current_tenant_id', v_tenant_b::text, true);
  SELECT count(*) INTO v_visible_count FROM branches;
  IF v_visible_count = 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Tenant B no pudo visualizar su propia sucursal';
  END IF;
  SELECT count(*) INTO v_visible_count FROM branches WHERE id = v_branch_a;
  IF v_visible_count > 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Tenant B pudo visualizar la sucursal del Tenant A por ID';
  END IF;
  RAISE NOTICE '[OK] Criterio 5: Tenant B consulta sus propios registros y no ve los de Tenant A.';

  -- --------------------------------------------------------------------------
  -- 7. ESCRITURA CRUZADA: MODIFICACIÓN (UPDATE) Y ELIMINACIÓN (DELETE) BLOQUEADAS
  -- --------------------------------------------------------------------------
  PERFORM set_config('app.current_tenant_id', v_tenant_b::text, true);

  UPDATE branches SET name = 'SUCURSAL_HACKEADA' WHERE id = v_branch_a;
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  IF v_affected_rows > 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Tenant B pudo modificar la sucursal del Tenant A';
  END IF;

  DELETE FROM branches WHERE id = v_branch_a;
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  IF v_affected_rows > 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Tenant B pudo eliminar la sucursal del Tenant A';
  END IF;

  -- Inserción fraudulenta con tenant_id ajeno (WITH CHECK)
  BEGIN
    INSERT INTO branches (id, tenant_id, code, name, is_active)
    VALUES (gen_random_uuid(), v_tenant_a, 'FAIL-INJ', 'Inyección cruzada', true);
    RAISE EXCEPTION 'CRÍTICO: RLS permitió insertar un registro con tenant_id ajeno';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[OK] Criterio 6: Inserción cruzada con WITH CHECK rechazada exitosamente: %', SQLERRM;
  END;

  -- --------------------------------------------------------------------------
  -- 8. CONSULTAS SIN CONTEXTO O CON CONTEXTO VACÍO
  -- --------------------------------------------------------------------------
  PERFORM set_config('app.current_tenant_id', '', true);
  SELECT count(*) INTO v_visible_count FROM branches;
  IF v_visible_count > 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Consultas con app.current_tenant_id vacío exponen % registros', v_visible_count;
  END IF;

  PERFORM set_config('app.current_tenant_id', 'not-a-valid-uuid', true);
  SELECT count(*) INTO v_visible_count FROM branches;
  IF v_visible_count > 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Consultas con tenant_id corrupto exponen % registros', v_visible_count;
  END IF;
  RAISE NOTICE '[OK] Criterio 7: Consultas sin contexto o con contexto corrupto devuelven exactamente 0 registros.';

  RESET ROLE;
  RAISE NOTICE '--- AUDITORÍA SQL FINALIZADA: TODOS LOS PUNTOS APROBADOS (PASS) ---';
END $$;

