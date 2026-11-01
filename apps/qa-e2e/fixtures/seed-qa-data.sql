-- ============================================================================
-- PREPARACIÓN Y SEMBRADO DE DATOS QA / BENCHMARK (UniSaaS E2E & k6)
-- ============================================================================

-- 1. Asegurar usuarios y hashes de contraseñas de prueba (password123)
UPDATE users 
SET password_hash = '$2a$10$Nv9bv7t23YCzTLvql2V8ROyW3cGcZbh3rz4Er.hyVNKBdu7QWeon6',
    is_active = true
WHERE email IN ('cajero@tenant-1111.com', 'cajero@tenant-2222.com');

-- 2. Asegurar estado activo de ambos tenants
UPDATE tenants 
SET is_active = true 
WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- 3. Asignar inventario de alta capacidad (1,000,000 unidades) para productos base
UPDATE inventory_balances
SET quantity_on_hand = 1000000.000000,
    reserved_quantity = 0.000000
WHERE variant_id IN (
  'f2222222-1111-1111-1111-111111111111',
  'f2222222-2222-2222-2222-222222222223'
);

-- 4. Sembrar catálogo distribuido de 20 productos para mitigar contención artificial de bloqueos en k6
DO $$
DECLARE
  v_tenant_a UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  v_warehouse_a UUID := 'b1111111-1111-1111-1111-111111111111'::UUID;
  v_category_a UUID := 'e1111111-1111-1111-1111-111111111111'::UUID;
  v_uom_a UUID := 'd1111111-1111-1111-1111-111111111111'::UUID;
  v_prod_id UUID;
  v_var_id UUID;
  v_bal_id UUID;
  i INT;
BEGIN
  FOR i IN 1..20 LOOP
    v_prod_id := ('f1111111-1111-1111-1111-' || lpad(i::text, 12, '0'))::UUID;
    v_var_id  := ('f2222222-1111-1111-1111-' || lpad(i::text, 12, '0'))::UUID;
    v_bal_id  := ('f3333333-1111-1111-1111-' || lpad(i::text, 12, '0'))::UUID;

    INSERT INTO products (id, tenant_id, sku, name, category_id, product_type, status, cost_price, sale_price, tax_rate, unit_of_measure_id, cost_method)
    VALUES (v_prod_id, v_tenant_a, 'SKU-QA-' || lpad(i::text, 3, '0'), 'Producto QA #' || i, v_category_a, 'STOCKABLE', 'ACTIVE', 1500, 3000, 0.19, v_uom_a, 'WEIGHTED_AVERAGE')
    ON CONFLICT (id) DO UPDATE SET sale_price = 3000;

    INSERT INTO product_variants (id, tenant_id, product_id, sku, name, status, cost_price, sale_price, tax_rate, min_stock_alert, unit_of_measure_id, is_default)
    VALUES (v_var_id, v_tenant_a, v_prod_id, 'SKU-QA-VAR-' || lpad(i::text, 3, '0'), 'Variante QA #' || i, 'ACTIVE', 1500, 3000, 0.19, 5, v_uom_a, true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO inventory_balances (id, tenant_id, product_id, variant_id, warehouse_id, quantity_on_hand, reserved_quantity, average_cost, inventory_value)
    VALUES (v_bal_id, v_tenant_a, v_prod_id, v_var_id, v_warehouse_a, 500000, 0, 1500, 750000000)
    ON CONFLICT (id) DO UPDATE SET quantity_on_hand = 500000;
  END LOOP;
END $$;
