-- ============================================================================
-- MIGRACIÓN INICIAL DEFINITIVA: 0_init_unisaas
-- Monolito Modular UniSaaS | PostgreSQL 16+ | Prisma 6 GA
-- Triple Blindaje RLS: ENABLE RLS + FORCE RLS + Rol app_runtime con Mínimos Privilegios
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "account_type_enum" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO');

-- CreateEnum
CREATE TYPE "account_nature_enum" AS ENUM ('D', 'C');

-- CreateEnum
CREATE TYPE "journal_source_doc_enum" AS ENUM ('SALE_POS', 'PURCHASE', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'REVERSAL', 'SHRINKAGE', 'MANUAL_ADJUSTMENT', 'OPENING_BALANCE', 'INVENTORY_MOVEMENT');

-- CreateEnum
CREATE TYPE "party_type_enum" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- CreateEnum
CREATE TYPE "purchase_payment_type_enum" AS ENUM ('CONTADO', 'CREDITO');

-- CreateEnum
CREATE TYPE "purchase_status_enum" AS ENUM ('RECEIVED', 'VOIDED');

-- CreateEnum
CREATE TYPE "credit_tx_type_enum" AS ENUM ('CHARGE_CREDIT_SALE', 'CUSTOMER_PAYMENT', 'SUPPLIER_PURCHASE', 'SUPPLIER_PAYMENT', 'VOID_REVERSAL');

-- CreateEnum
CREATE TYPE "credit_payment_method_enum" AS ENUM ('EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TARJETA', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "product_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "product_type_enum" AS ENUM ('STOCKABLE', 'SERVICE');

-- CreateEnum
CREATE TYPE "variant_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "warehouse_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "movement_type_enum" AS ENUM ('PURCHASE_RECEIPT', 'SALE_DISPATCH', 'TRANSFER_IN', 'TRANSFER_OUT', 'SHRINKAGE_LOSS', 'DAMAGE_LOSS', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'VOID_RETURN');

-- CreateEnum
CREATE TYPE "movement_status_enum" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "movement_source_enum" AS ENUM ('POS', 'PURCHASE', 'TRANSFER', 'ADJUSTMENT', 'STOCK_COUNT', 'RETURN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "reference_type_enum" AS ENUM ('POS_SALE', 'POS_VOID', 'PURCHASE', 'PURCHASE_RETURN', 'TRANSFER', 'STOCK_COUNT', 'MANUAL_ADJUSTMENT', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'OTHER');

-- CreateEnum
CREATE TYPE "transfer_status_enum" AS ENUM ('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "barcode_type_enum" AS ENUM ('EAN13', 'EAN8', 'UPC', 'CODE128', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "cost_method_enum" AS ENUM ('WEIGHTED_AVERAGE');

-- CreateEnum
CREATE TYPE "adjustment_reason_enum" AS ENUM ('INITIAL_STOCK', 'STOCK_COUNT', 'DAMAGE', 'LOSS', 'FOUND', 'CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "stock_count_status_enum" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "stock_count_line_status_enum" AS ENUM ('PENDING', 'COUNTED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "unit_type_enum" AS ENUM ('UNIT', 'LENGTH', 'WEIGHT', 'VOLUME', 'PACKAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "pos_shift_status_enum" AS ENUM ('OPEN', 'CLOSED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "invoice_payment_method_enum" AS ENUM ('EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TARJETA', 'CREDITO_FIADO', 'MIXTO');

-- CreateEnum
CREATE TYPE "invoice_status_enum" AS ENUM ('ISSUED', 'VOIDED');

-- CreateEnum
CREATE TYPE "outbox_status_enum" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "tax_regime_enum" AS ENUM ('REGIMEN_SIMPLE', 'RESPONSABLE_IVA', 'NO_RESPONSABLE_IVA', 'GRAN_CONTRIBUYENTE', 'REGIMEN_ESPECIAL');

-- CreateEnum
CREATE TYPE "document_type_enum" AS ENUM ('CC', 'CE', 'TI', 'NIT', 'PP', 'PEP');

-- CreateEnum
CREATE TYPE "user_role_enum" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER');

-- CreateEnum
CREATE TYPE "audit_action_enum" AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE', 'POST', 'REVERSE', 'TRANSFER', 'ADJUST', 'STOCK_COUNT');

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "account_type" "account_type_enum" NOT NULL,
    "nature" "account_nature_enum" NOT NULL,
    "parent_id" UUID,
    "is_selectable" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "entry_number" BIGINT NOT NULL,
    "entry_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concept" VARCHAR(255) NOT NULL,
    "source_document_type" "journal_source_doc_enum" NOT NULL,
    "source_document_id" UUID,
    "total_debit" DECIMAL(15,2) NOT NULL,
    "total_credit" DECIMAL(15,2) NOT NULL,
    "is_reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversal_entry_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "journal_entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "third_party_id" UUID,
    "debit" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "credit" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "description" VARCHAR(255),
    "nature" "account_nature_enum" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "third_parties" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_type" "document_type_enum" NOT NULL DEFAULT 'CC',
    "document_number" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(100),
    "address" VARCHAR(200),
    "party_type" "party_type_enum" NOT NULL,
    "credit_limit" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "current_debt" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "third_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_invoice_number" VARCHAR(50) NOT NULL,
    "purchase_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "tax_total" DECIMAL(15,2) NOT NULL,
    "grand_total" DECIMAL(15,2) NOT NULL,
    "payment_type" "purchase_payment_type_enum" NOT NULL,
    "due_date" DATE,
    "status" "purchase_status_enum" NOT NULL DEFAULT 'RECEIVED',
    "void_reason" TEXT,
    "journal_entry_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" VARCHAR(150) NOT NULL,
    "product_sku" VARCHAR(50) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit_of_measure" VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',
    "unit_cost" DECIMAL(18,6) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.19,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "tax_amount" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "third_party_id" UUID NOT NULL,
    "type" "credit_tx_type_enum" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "previous_balance" DECIMAL(15,2) NOT NULL,
    "new_balance" DECIMAL(15,2) NOT NULL,
    "payment_method" "credit_payment_method_enum",
    "reference_number" VARCHAR(50),
    "journal_entry_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_of_measures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "unit_type" "unit_type_enum" NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 3,
    "conversion_factor" DECIMAL(18,6) NOT NULL DEFAULT 1.000000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_of_measures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "barcode" VARCHAR(50),
    "category_id" UUID,
    "product_type" "product_type_enum" NOT NULL DEFAULT 'STOCKABLE',
    "status" "product_status_enum" NOT NULL DEFAULT 'ACTIVE',
    "cost_price" DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    "sale_price" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "wholesale_price" DECIMAL(15,2),
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.19,
    "min_stock_alert" DECIMAL(18,6) NOT NULL DEFAULT 5.000000,
    "unit_of_measure_id" UUID NOT NULL,
    "cost_method" "cost_method_enum" NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "status" "variant_status_enum" NOT NULL DEFAULT 'ACTIVE',
    "cost_price" DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    "sale_price" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "wholesale_price" DECIMAL(15,2),
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.19,
    "min_stock_alert" DECIMAL(18,6) NOT NULL DEFAULT 5.000000,
    "unit_of_measure_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_barcodes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "barcode" VARCHAR(50) NOT NULL,
    "type" "barcode_type_enum" NOT NULL DEFAULT 'INTERNAL',
    "product_id" UUID,
    "variant_id" UUID,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" "warehouse_status_enum" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity_on_hand" DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    "reserved_quantity" DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    "average_cost" DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    "inventory_value" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "version" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_warehouse_id" UUID NOT NULL,
    "destination_warehouse_id" UUID NOT NULL,
    "status" "transfer_status_enum" NOT NULL DEFAULT 'DRAFT',
    "reference_document" VARCHAR(100),
    "notes" TEXT,
    "outbound_movement_id" UUID,
    "inbound_movement_id" UUID,
    "created_by_id" UUID,
    "completed_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shipped_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "transfer_unit_cost" DECIMAL(18,6) NOT NULL,
    "transfer_total_cost" DECIMAL(20,4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" "stock_count_status_enum" NOT NULL DEFAULT 'DRAFT',
    "reference_document" VARCHAR(100),
    "notes" TEXT,
    "created_by_id" UUID,
    "completed_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "stock_count_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "system_quantity" DECIMAL(18,6) NOT NULL,
    "counted_quantity" DECIMAL(18,6),
    "difference_quantity" DECIMAL(18,6),
    "status" "stock_count_line_status_enum" NOT NULL DEFAULT 'PENDING',
    "counted_by_id" UUID,
    "counted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "movement_type_enum" NOT NULL,
    "status" "movement_status_enum" NOT NULL DEFAULT 'DRAFT',
    "source" "movement_source_enum" NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "reference_type" "reference_type_enum",
    "reference_id" UUID,
    "reference_document" VARCHAR(100),
    "reason" TEXT,
    "adjustment_reason" "adjustment_reason_enum",
    "created_by_id" UUID,
    "posted_by_id" UUID,
    "reversed_by_id" UUID,
    "reverses_movement_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMPTZ,
    "reversed_at" TIMESTAMPTZ,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movement_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "movement_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "unit_of_measure_id" UUID NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL,
    "total_cost" DECIMAL(20,4) NOT NULL,
    "previous_quantity" DECIMAL(18,6) NOT NULL,
    "new_quantity" DECIMAL(18,6) NOT NULL,
    "average_cost_before" DECIMAL(18,6) NOT NULL,
    "average_cost_after" DECIMAL(18,6) NOT NULL,
    "inventory_value_before" DECIMAL(20,4) NOT NULL,
    "inventory_value_after" DECIMAL(20,4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ledger_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "movement_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "movement_type" "movement_type_enum" NOT NULL,
    "reference_type" "reference_type_enum",
    "reference_id" UUID,
    "quantity_in" DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    "unit_cost_in" DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    "total_cost_in" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "quantity_out" DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    "unit_cost_out" DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
    "total_cost_out" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "balance_quantity_after" DECIMAL(18,6) NOT NULL,
    "average_cost_after" DECIMAL(18,6) NOT NULL,
    "inventory_value_after" DECIMAL(20,4) NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "action" "audit_action_enum" NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "movement_id" UUID,
    "performed_by_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "reason" TEXT,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "shift_number" BIGINT NOT NULL,
    "opening_time" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closing_time" TIMESTAMPTZ,
    "initial_cash" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_sales" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_cash_sales" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_digital_sales" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_credit_sales" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "expected_cash" DECIMAL(15,2),
    "actual_cash" DECIMAL(15,2),
    "difference" DECIMAL(15,2),
    "status" "pos_shift_status_enum" NOT NULL DEFAULT 'OPEN',
    "closed_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "pos_shift_id" UUID,
    "consecutive" VARCHAR(50) NOT NULL,
    "customer_id" UUID,
    "customer_name" VARCHAR(150) NOT NULL DEFAULT 'Consumidor Final',
    "customer_document" VARCHAR(20) NOT NULL DEFAULT '222222222',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discount_total" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_total" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "payment_method" "invoice_payment_method_enum" NOT NULL,
    "cash_tendered" DECIMAL(15,2),
    "change_given" DECIMAL(15,2),
    "journal_entry_id" UUID,
    "status" "invoice_status_enum" NOT NULL DEFAULT 'ISSUED',
    "void_reason" TEXT,
    "voided_by" UUID,
    "voided_at" TIMESTAMPTZ,
    "idempotency_key" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" VARCHAR(150) NOT NULL,
    "product_sku" VARCHAR(50) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit_of_measure" VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',
    "unit_price" DECIMAL(15,2) NOT NULL,
    "unit_cost" DECIMAL(18,6) NOT NULL,
    "discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.19,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_idempotency_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "status_code" INTEGER,
    "response_body" JSONB,
    "resource_type" VARCHAR(100),
    "resource_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "inventory_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_status_enum" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "nit_rut" VARCHAR(20) NOT NULL,
    "business_name" VARCHAR(150) NOT NULL,
    "trade_name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "country_code" VARCHAR(3) NOT NULL DEFAULT 'COL',
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "tax_regime" "tax_regime_enum" NOT NULL DEFAULT 'REGIMEN_SIMPLE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(200),
    "phone" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID,
    "document_type" "document_type_enum" NOT NULL DEFAULT 'CC',
    "document_number" VARCHAR(20) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(50),
    "role" "user_role_enum" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sequence_key" VARCHAR(50) NOT NULL,
    "current_value" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "tenant_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "entity_name" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(300),
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_chart_tenant_type" ON "chart_of_accounts"("tenant_id", "account_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_account_code" ON "chart_of_accounts"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_chart_tenant_id" ON "chart_of_accounts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversal_entry_id_key" ON "journal_entries"("reversal_entry_id");

-- CreateIndex
CREATE INDEX "idx_journal_entries_date" ON "journal_entries"("tenant_id", "entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_entry_number" ON "journal_entries"("tenant_id", "entry_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_journal_entries_tenant_id" ON "journal_entries"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_jel_entry" ON "journal_entry_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "idx_jel_account" ON "journal_entry_lines"("tenant_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_journal_lines_tenant_id" ON "journal_entry_lines"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_third_party_doc" ON "third_parties"("tenant_id", "document_type", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_third_parties_tenant_id" ON "third_parties"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_supplier_inv" ON "purchases"("tenant_id", "supplier_id", "supplier_invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_purchases_tenant_id" ON "purchases"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_purchase_items_purchase" ON "purchase_items"("purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_purchase_items_tenant_id" ON "purchase_items"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_journal_entry_id_key" ON "credit_transactions"("journal_entry_id");

-- CreateIndex
CREATE INDEX "idx_credit_tx_timeline" ON "credit_transactions"("tenant_id", "third_party_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_credit_tx_tenant_id" ON "credit_transactions"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_category_tenant_parent" ON "product_categories"("tenant_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_category_name" ON "product_categories"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_categories_tenant_id" ON "product_categories"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_uom_tenant_type" ON "unit_of_measures"("tenant_id", "unit_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_uom_code" ON "unit_of_measures"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_unit_of_measures_tenant_id" ON "unit_of_measures"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_products_tenant_barcode" ON "products"("tenant_id", "barcode");

-- CreateIndex
CREATE INDEX "idx_products_tenant_category" ON "products"("tenant_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_product_sku" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "uq_products_tenant_id" ON "products"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_variants_tenant_product" ON "product_variants"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_variant_sku" ON "product_variants"("tenant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_variants_tenant_id" ON "product_variants"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_barcodes_tenant_product" ON "product_barcodes"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "idx_barcodes_tenant_variant" ON "product_barcodes"("tenant_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_barcode" ON "product_barcodes"("tenant_id", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_barcodes_tenant_id" ON "product_barcodes"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_warehouses_tenant_branch" ON "warehouses"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_warehouse_code" ON "warehouses"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warehouses_tenant_id" ON "warehouses"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_balances_warehouse" ON "inventory_balances"("tenant_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "idx_balances_product" ON "inventory_balances"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_variant_warehouse" ON "inventory_balances"("tenant_id", "variant_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_balances_tenant_id" ON "inventory_balances"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfers_outbound_movement_id_key" ON "inventory_transfers"("outbound_movement_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfers_inbound_movement_id_key" ON "inventory_transfers"("inbound_movement_id");

-- CreateIndex
CREATE INDEX "idx_transfers_source" ON "inventory_transfers"("tenant_id", "source_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_transfers_destination" ON "inventory_transfers"("tenant_id", "destination_warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_transfers_tenant_id" ON "inventory_transfers"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_transfer_line_number" ON "inventory_transfer_lines"("transfer_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_transfer_lines_tenant_id" ON "inventory_transfer_lines"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_stock_counts_warehouse" ON "stock_counts"("tenant_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stock_counts_tenant_id" ON "stock_counts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stock_count_variant" ON "stock_count_lines"("stock_count_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_stock_count_lines_tenant_id" ON "stock_count_lines"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_reverses_movement_id_key" ON "inventory_movements"("reverses_movement_id");

-- CreateIndex
CREATE INDEX "idx_movements_tenant_wh_date" ON "inventory_movements"("tenant_id", "warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_movements_reference" ON "inventory_movements"("tenant_id", "reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_movements_tenant_id" ON "inventory_movements"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_movement_lines_product" ON "inventory_movement_lines"("tenant_id", "product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_movement_line_number" ON "inventory_movement_lines"("movement_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_movement_lines_tenant_id" ON "inventory_movement_lines"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_ledger_entries_sequence_key" ON "inventory_ledger_entries"("sequence");

-- CreateIndex
CREATE INDEX "idx_ledger_kardex_timeline" ON "inventory_ledger_entries"("tenant_id", "variant_id", "warehouse_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_ledger_product_timeline" ON "inventory_ledger_entries"("tenant_id", "product_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_ledger_tenant_id" ON "inventory_ledger_entries"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_inv_audit_entity" ON "inventory_audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_audit_tenant_id" ON "inventory_audit_logs"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_shift_number" ON "pos_shifts"("tenant_id", "shift_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pos_shifts_tenant_id" ON "pos_shifts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_idempotency_key_key" ON "invoices"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_invoice_consecutive" ON "invoices"("tenant_id", "consecutive");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoices_tenant_id" ON "invoices"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_invoice_items_invoice" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_items_tenant_id" ON "invoice_items"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_idempotency_key" ON "inventory_idempotency_keys"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_idempotency_tenant_id" ON "inventory_idempotency_keys"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_outbox_tenant_status" ON "inventory_outbox_events"("tenant_id", "status", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_outbox_tenant_id" ON "inventory_outbox_events"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_nit_rut_key" ON "tenants"("nit_rut");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_branch_code" ON "branches"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_branches_tenant_id" ON "branches"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_users_tenant_role" ON "users"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "idx_users_tenant_branch" ON "users"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_user_email" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_user_doc" ON "users"("tenant_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_tenant_id" ON "users"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_sequence" ON "tenant_sequences"("tenant_id", "sequence_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_sequences_tenant_id" ON "tenant_sequences"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_audit_tenant_entity" ON "audit_logs"("tenant_id", "entity_name", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_audit_logs_tenant_id" ON "audit_logs"("tenant_id", "id");

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_entry_id_fkey" FOREIGN KEY ("reversal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_third_party_id_fkey" FOREIGN KEY ("third_party_id") REFERENCES "third_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_parties" ADD CONSTRAINT "third_parties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "third_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_third_party_id_fkey" FOREIGN KEY ("third_party_id") REFERENCES "third_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_of_measures" ADD CONSTRAINT "unit_of_measures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_outbound_movement_id_fkey" FOREIGN KEY ("outbound_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_inbound_movement_id_fkey" FOREIGN KEY ("inbound_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reverses_movement_id_fkey" FOREIGN KEY ("reverses_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "unit_of_measures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_logs" ADD CONSTRAINT "inventory_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_logs" ADD CONSTRAINT "inventory_audit_logs_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_logs" ADD CONSTRAINT "inventory_audit_logs_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shifts" ADD CONSTRAINT "pos_shifts_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pos_shift_id_fkey" FOREIGN KEY ("pos_shift_id") REFERENCES "pos_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "third_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_idempotency_keys" ADD CONSTRAINT "inventory_idempotency_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_outbox_events" ADD CONSTRAINT "inventory_outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_sequences" ADD CONSTRAINT "tenant_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ============================================================================
-- SCRIPT DE ENDURECIMIENTO DE SEGURIDAD Y PRIVILEGIOS MÍNIMOS (RLS HARDENING)
-- ============================================================================

-- 1. CREACIÓN DEL ROL DE EJECUCIÓN APP_RUNTIME (SEPARACIÓN DE PRIVILEGIOS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH 
      LOGIN 
      NOSUPERUSER 
      NOINHERIT 
      NOCREATEROLE 
      NOREPLICATION 
      NOBYPASSRLS;
  ELSE
    ALTER ROLE app_runtime WITH 
      NOSUPERUSER 
      NOINHERIT 
      NOCREATEROLE 
      NOREPLICATION 
      NOBYPASSRLS;
  END IF;
END $$;

-- Permitir que el rol de conexión de la aplicación (saas_migration_admin) pueda asumir app_runtime
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'saas_migration_admin') THEN
    GRANT app_runtime TO saas_migration_admin;
  END IF;
END $$;

-- 2. FUNCIÓN DE SEGURIDAD PARA CONTEXTO DE TENANT (CON SEARCH_PATH FIJO)
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_tenant_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION current_tenant_id() TO saas_migration_admin;

-- 3. PERMISOS DE ESQUEMA Y TABLAS PARA APP_RUNTIME
GRANT USAGE ON SCHEMA public TO app_runtime;
REVOKE CREATE ON SCHEMA public FROM app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- 4. PROCEDIMIENTO MACRO PARA ACTIVAR ENABLE + FORCE RLS Y POLÍTICA DE AISLAMIENTO
CREATE OR REPLACE PROCEDURE enable_strict_tenant_rls(table_name text) AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', table_name);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', table_name);
  EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());', table_name);
END;
$$ LANGUAGE plpgsql;

-- 5. LISTA DE TABLAS MULTI-TENANT A BLINDAR CON FORCE RLS
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'branches',
    'third_parties',
    'chart_of_accounts',
    'product_categories',
    'unit_of_measures',
    'products',
    'product_variants',
    'product_barcodes',
    'users',
    'warehouses',
    'inventory_balances',
    'inventory_transfers',
    'inventory_transfer_lines',
    'stock_counts',
    'stock_count_lines',
    'inventory_movements',
    'inventory_movement_lines',
    'inventory_ledger_entries',
    'journal_entries',
    'journal_entry_lines',
    'pos_shifts',
    'invoices',
    'invoice_items',
    'purchases',
    'purchase_items',
    'credit_transactions',
    'tenant_sequences',
    'audit_logs',
    'inventory_idempotency_keys',
    'inventory_outbox_events',
    'inventory_audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      CALL enable_strict_tenant_rls(t);
    END IF;
  END LOOP;
END $$;