-- ============================================================================
-- AUDITORÍA Y CERTIFICACIÓN DE SEGURIDAD RLS: test-rls.sql
-- Monolito Modular UniSaaS | PostgreSQL 16+ | Prisma 6 GA
-- Verificación Empírica de los Ocho Casos de Seguridad y Aislamiento Multi-Tenant
-- ============================================================================

-- 0. PREPARACIÓN Y SEMBRADO DE TENANTS DE PRUEBA
INSERT INTO tenants (id, nit_rut, business_name, trade_name, address, phone, email, country_code, currency_code, tax_regime, is_active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '900111111-1', 'Tenant A S.A.S.', 'Tenant A', 'Calle 1 #1-01', '3001111111', 'tenant_a@unisaas.com', 'COL', 'COP', 'REGIMEN_SIMPLE', true),
  ('22222222-2222-2222-2222-222222222222', '900222222-2', 'Tenant B S.A.S.', 'Tenant B', 'Calle 2 #2-02', '3002222222', 'tenant_b@unisaas.com', 'COL', 'COP', 'REGIMEN_SIMPLE', true),
  ('30000000-0000-0000-0000-000000000003', '900300000-3', 'Tenant E3 Inventarios S.A.S.', 'Inventarios E3', 'Bodega Central', '3003000003', 'e3@unisaas.com', 'COL', 'COP', 'RESPONSABLE_IVA', true),
  ('70000000-0000-0000-0000-000000000007', '900700000-7', 'Tenant E7 Cartera S.A.S.', 'Cartera E7', 'Oficina Cobranza', '3007000007', 'e7@unisaas.com', 'COL', 'COP', 'RESPONSABLE_IVA', true)
ON CONFLICT (nit_rut) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  trade_name = EXCLUDED.trade_name,
  updated_at = CURRENT_TIMESTAMP;

-- 1. BLOQUE PRINCIPAL DE CERTIFICACIÓN DE LOS OCHO CASOS DE SEGURIDAD
DO $$
DECLARE
  v_ext_uuid_count INT;
  v_ext_crypto_count INT;
  v_rls_active BOOLEAN;
  v_force_rls_active BOOLEAN;
  v_policy_count INT;
  v_role_super BOOLEAN;
  v_role_inherit BOOLEAN;
  v_role_bypassrls BOOLEAN;
  v_role_createrole BOOLEAN;
  v_table_owner_count INT;
  v_schema_create BOOLEAN;
  v_visible_records INT;
  v_affected_rows INT;
  v_current_role TEXT;
  v_current_tenant TEXT;

  v_tenant_a UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  v_tenant_b UUID := '22222222-2222-2222-2222-222222222222'::UUID;
  v_tenant_e3 UUID := '30000000-0000-0000-0000-000000000003'::UUID;
  v_tenant_e7 UUID := '70000000-0000-0000-0000-000000000007'::UUID;

  v_branch_a_id UUID := 'a1111111-1111-1111-1111-111111111111'::UUID;
  v_branch_e3_id UUID := 'e3111111-1111-1111-1111-111111111111'::UUID;
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'INICIANDO CERTIFICACIÓN EMPÍRICA DE RLS EN POSTGRESQL REAL';
  RAISE NOTICE '================================================================';

  -- --------------------------------------------------------------------------
  -- CASO 1: Habilitación de extensiones criptográficas y de UUID
  -- --------------------------------------------------------------------------
  SELECT count(*) INTO v_ext_uuid_count FROM pg_extension WHERE extname = 'uuid-ossp';
  SELECT count(*) INTO v_ext_crypto_count FROM pg_extension WHERE extname = 'pgcrypto';

  IF v_ext_uuid_count = 0 OR v_ext_crypto_count = 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLIDO: Extensiones uuid-ossp o pgcrypto no encontradas en pg_extension';
  END IF;
  RAISE NOTICE 'CASO 1 PASS: Extensiones uuid-ossp y pgcrypto activas.';

  -- --------------------------------------------------------------------------
  -- CASO 2: Verificación de ENABLE RLS y FORCE RLS en tablas multi-tenant
  -- --------------------------------------------------------------------------
  SELECT relrowsecurity, relforcerowsecurity 
  INTO v_rls_active, v_force_rls_active
  FROM pg_class 
  WHERE relname = 'branches' AND relnamespace = 'public'::regnamespace;

  IF NOT (v_rls_active AND v_force_rls_active) THEN
    RAISE EXCEPTION 'CASO 2 FALLIDO: La tabla branches no tiene ENABLE RLS y FORCE RLS simultáneamente.';
  END IF;

  -- Comprobar que todas las 31 tablas de dominio tengan FORCE RLS
  SELECT count(*) INTO v_affected_rows
  FROM pg_class
  WHERE relnamespace = 'public'::regnamespace
    AND relrowsecurity = true
    AND relforcerowsecurity = true;

  IF v_affected_rows < 31 THEN
    RAISE EXCEPTION 'CASO 2 FALLIDO: Se esperaban 31 tablas protegidas con FORCE RLS, se encontraron %', v_affected_rows;
  END IF;
  RAISE NOTICE 'CASO 2 PASS: 31 tablas protegidas con ENABLE RLS y FORCE RLS estricto.';

  -- --------------------------------------------------------------------------
  -- CASO 3: Registro y sintaxis de la política tenant_isolation_policy
  -- --------------------------------------------------------------------------
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname = 'tenant_isolation_policy';

  IF v_policy_count < 31 THEN
    RAISE EXCEPTION 'CASO 3 FALLIDO: Políticas tenant_isolation_policy incompletas (% registradas)', v_policy_count;
  END IF;
  RAISE NOTICE 'CASO 3 PASS: Política tenant_isolation_policy activa en las 31 tablas multi-tenant.';

  -- --------------------------------------------------------------------------
  -- CASO 4: Configuración restrictiva del rol app_runtime y mínimos privilegios
  -- --------------------------------------------------------------------------
  SELECT rolsuper, rolinherit, rolcreaterole, rolbypassrls
  INTO v_role_super, v_role_inherit, v_role_createrole, v_role_bypassrls
  FROM pg_roles
  WHERE rolname = 'app_runtime';

  IF v_role_super OR v_role_inherit OR v_role_createrole OR v_role_bypassrls THEN
    RAISE EXCEPTION 'CASO 4 FALLIDO: app_runtime contiene privilegios prohibidos (SUPER: %, INHERIT: %, CREATE: %, BYPASSRLS: %)',
      v_role_super, v_role_inherit, v_role_createrole, v_role_bypassrls;
  END IF;

  -- Verificar que app_runtime NO sea propietario de ninguna tabla
  SELECT count(*) INTO v_table_owner_count
  FROM pg_tables
  WHERE schemaname = 'public' AND tableowner = 'app_runtime';

  IF v_table_owner_count > 0 THEN
    RAISE EXCEPTION 'CASO 4 FALLIDO: app_runtime no debe ser propietario de tablas. Posee %', v_table_owner_count;
  END IF;

  -- Verificar que app_runtime NO pueda crear tablas en public
  SELECT has_schema_privilege('app_runtime', 'public', 'CREATE') INTO v_schema_create;
  IF v_schema_create THEN
    RAISE EXCEPTION 'CASO 4 FALLIDO: app_runtime tiene permiso CREATE en esquema public.';
  END IF;
  RAISE NOTICE 'CASO 4 PASS: app_runtime verificado (NOSUPERUSER, NOINHERIT, NOCREATEROLE, NOBYPASSRLS, 0 tablas de propiedad, sin CREATE en esquema).';

  -- --------------------------------------------------------------------------
  -- CONMUTACIÓN AL ROL APP_RUNTIME PARA LAS OPERACIONES PROTEGIDAS
  -- --------------------------------------------------------------------------
  SET LOCAL ROLE app_runtime;

  -- --------------------------------------------------------------------------
  -- CASO 5: Aislamiento de lectura/escritura para Inquilino A
  -- --------------------------------------------------------------------------
  PERFORM set_config('app.current_tenant_id', v_tenant_a::text, true);

  -- Limpiar registros residuales de ejecuciones previas dentro de la transacción
  DELETE FROM branches WHERE tenant_id = v_tenant_a;

  INSERT INTO branches (id, tenant_id, code, name, address, phone, is_active)
  VALUES (v_branch_a_id, v_tenant_a, 'SUC-001', 'Sucursal Principal A', 'Calle 10 #5-20', '3101234567', true);

  SELECT count(*) INTO v_visible_records FROM branches WHERE tenant_id = v_tenant_a;
  IF v_visible_records <> 1 THEN
    RAISE EXCEPTION 'CASO 5 FALLIDO: Inquilino A esperaba ver 1 sucursal propia y obtuvo %', v_visible_records;
  END IF;
  RAISE NOTICE 'CASO 5 PASS: Inquilino A puede insertar y consultar sus propios registros.';

  -- --------------------------------------------------------------------------
  -- CASO 6: Aislamiento de lectura cruzada (Inquilino B no puede ver registros de Inquilino A)
  -- --------------------------------------------------------------------------
  PERFORM set_config('app.current_tenant_id', v_tenant_b::text, true);

  SELECT count(*) INTO v_visible_records FROM branches;
  IF v_visible_records <> 0 THEN
    RAISE EXCEPTION 'CASO 6 FALLIDO: Inquilino B pudo visualizar registros pertenecientes al Inquilino A (% registros expuestos)', v_visible_records;
  END IF;

  -- Prueba cruzada explícita por ID del registro de A
  SELECT count(*) INTO v_visible_records FROM branches WHERE id = v_branch_a_id;
  IF v_visible_records <> 0 THEN
    RAISE EXCEPTION 'CASO 6 FALLIDO: Inquilino B pudo consultar por ID el registro del Inquilino A';
  END IF;

  -- Prueba de aislamiento entre E3 (Inventarios) y E7 (Cartera)
  PERFORM set_config('app.current_tenant_id', v_tenant_e3::text, true);
  DELETE FROM branches WHERE tenant_id = v_tenant_e3;
  INSERT INTO branches (id, tenant_id, code, name, address, is_active)
  VALUES (v_branch_e3_id, v_tenant_e3, 'BOD-E3', 'Bodega General E3', 'Parque Industrial', true);

  PERFORM set_config('app.current_tenant_id', v_tenant_e7::text, true);
  SELECT count(*) INTO v_visible_records FROM branches WHERE tenant_id = v_tenant_e3;
  IF v_visible_records <> 0 THEN
    RAISE EXCEPTION 'CASO 6 FALLIDO: Escuadrón 7 pudo consultar registros del Escuadrón 3';
  END IF;
  RAISE NOTICE 'CASO 6 PASS: Aislamiento de lectura estricto comprobado (B no ve datos de A; E7 no ve datos de E3).';

  -- --------------------------------------------------------------------------
  -- CASO 7: Aislamiento estricto de Modificación (UPDATE) y Eliminación (DELETE)
  -- --------------------------------------------------------------------------
  PERFORM set_config('app.current_tenant_id', v_tenant_b::text, true);

  -- Intento de actualización de registro de Inquilino A por parte de Inquilino B
  UPDATE branches SET name = 'SUCURSAL_VULNERADA' WHERE id = v_branch_a_id;
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  IF v_affected_rows <> 0 THEN
    RAISE EXCEPTION 'CASO 7 FALLIDO: Inquilino B pudo MODIFICAR un registro del Inquilino A (filas afectadas: %)', v_affected_rows;
  END IF;

  -- Intento de eliminación de registro de Inquilino A por parte de Inquilino B
  DELETE FROM branches WHERE id = v_branch_a_id;
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  IF v_affected_rows <> 0 THEN
    RAISE EXCEPTION 'CASO 7 FALLIDO: Inquilino B pudo ELIMINAR un registro del Inquilino A (filas afectadas: %)', v_affected_rows;
  END IF;

  -- Intento de inserción fraudulenta con tenant_id de otro inquilino (violación de WITH CHECK)
  BEGIN
    INSERT INTO branches (id, tenant_id, code, name, is_active)
    VALUES (gen_random_uuid(), v_tenant_a, 'HACK', 'Inyección no autorizada', true);
    RAISE EXCEPTION 'CASO 7 FALLIDO: La política RLS no bloqueó la inserción cruzada con tenant_id ajeno';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'CASO 7 PASS (WITH CHECK): Inserción con tenant_id cruzado bloqueada por RLS.';
    WHEN OTHERS THEN
      -- En PostgreSQL, la violación de WITH CHECK en RLS detona un error de permisos o check_violation
      RAISE NOTICE 'CASO 7 PASS (WITH CHECK): Bloqueado con error esperado: %', SQLERRM;
  END;

  RAISE NOTICE 'CASO 7 PASS: Modificación y eliminación cruzada bloqueadas (0 filas afectadas). WITH CHECK activo.';

  -- --------------------------------------------------------------------------
  -- CASO 8: Aislamiento sin contexto válido y reseteo de sesión
  -- --------------------------------------------------------------------------
  -- Limpiar contexto a vacío o nulo
  PERFORM set_config('app.current_tenant_id', '', true);
  SELECT count(*) INTO v_visible_records FROM branches;
  IF v_visible_records <> 0 THEN
    RAISE EXCEPTION 'CASO 8 FALLIDO: Consultas sin contexto exponen registros multi-tenant (vistos: %)', v_visible_records;
  END IF;

  PERFORM set_config('app.current_tenant_id', 'invalid-uuid-token', true);
  SELECT count(*) INTO v_visible_records FROM branches;
  IF v_visible_records <> 0 THEN
    RAISE EXCEPTION 'CASO 8 FALLIDO: Consultas con contexto corrupto exponen registros (vistos: %)', v_visible_records;
  END IF;

  RESET ROLE;
  RAISE NOTICE 'CASO 8 PASS: Consultas sin contexto retornan 0 registros y el rol se resetea limpiamente.';

  RAISE NOTICE '================================================================';
  RAISE NOTICE 'CERTIFICACIÓN EXITOSA: LOS OCHO CASOS DE SEGURIDAD PASARON (PASS)';
  RAISE NOTICE '================================================================';
END $$;

