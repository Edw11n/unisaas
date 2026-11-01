-- AlterTable: Adición de ciclo de vida, leases y recuperación para idempotencia durable
CREATE TYPE "idempotency_status_enum" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

ALTER TABLE "inventory_idempotency_keys"
  ADD COLUMN "status" "idempotency_status_enum" NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN "locked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "recovery_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "idx_idempotency_tenant_status" ON "inventory_idempotency_keys"("tenant_id", "status", "locked_at");

