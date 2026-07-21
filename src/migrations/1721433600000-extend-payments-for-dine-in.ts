import { MigrationInterface, QueryRunner } from 'typeorm';

/** Extends the existing delivery payment ledger for Dine-In attempts. */
export class ExtendPaymentsForDineIn1721433600000 implements MigrationInterface {
  name = 'ExtendPaymentsForDineIn1721433600000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'CASH'`,
    );
    for (const status of [
      'CREATED',
      'AWAITING_CASH_CONFIRMATION',
      'PROCESSING',
      'SUCCESS',
      'EXPIRED',
    ]) {
      await queryRunner.query(
        `ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS '${status}'`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "order_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "payment_reference" character varying,
        ADD COLUMN IF NOT EXISTS "invoice_id" uuid,
        ADD COLUMN IF NOT EXISTS "dine_in_session_id" uuid,
        ADD COLUMN IF NOT EXISTS "restaurant_id" uuid,
        ADD COLUMN IF NOT EXISTS "currency" character varying(3) NOT NULL DEFAULT 'INR',
        ADD COLUMN IF NOT EXISTS "idempotency_key" character varying,
        ADD COLUMN IF NOT EXISTS "failure_code" character varying,
        ADD COLUMN IF NOT EXISTS "initiated_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "gateway_event_id" character varying,
        ADD COLUMN IF NOT EXISTS "cash_confirmed_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments"
        ADD CONSTRAINT "FK_payments_invoice" FOREIGN KEY ("invoice_id")
          REFERENCES "dine_in_invoices"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments"
        ADD CONSTRAINT "FK_payments_dine_in_session" FOREIGN KEY ("dine_in_session_id")
          REFERENCES "dine_in_sessions"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments"
        ADD CONSTRAINT "FK_payments_restaurant" FOREIGN KEY ("restaurant_id")
          REFERENCES "restaurants"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments"
        ADD CONSTRAINT "FK_payments_cash_confirmer" FOREIGN KEY ("cash_confirmed_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_reference" ON "payments" ("payment_reference")
        WHERE "payment_reference" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_dine_in_payment_idempotency" ON "payments" ("invoice_id", "idempotency_key")
        WHERE "invoice_id" IS NOT NULL AND "idempotency_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_dine_in_invoice_success_payment" ON "payments" ("invoice_id")
        WHERE "invoice_id" IS NOT NULL
          AND "status" IN ('PAID'::payment_status, 'SUCCESS'::payment_status)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_gateway_order" ON "payments" ("gateway_order_id")
        WHERE "gateway_order_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_gateway_payment" ON "payments" ("gateway_payment_id")
        WHERE "gateway_payment_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_gateway_event" ON "payments" ("gateway_event_id")
        WHERE "gateway_event_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dine_in_payments_restaurant_initiated" ON "payments" ("restaurant_id", "initiated_at")
        WHERE "invoice_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dine_in_payments_session" ON "payments" ("dine_in_session_id")
        WHERE "invoice_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_dine_in_payments_session"`);
    await queryRunner.query(
      `DROP INDEX "IDX_dine_in_payments_restaurant_initiated"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_payments_gateway_event"`);
    await queryRunner.query(`DROP INDEX "UQ_payments_gateway_payment"`);
    await queryRunner.query(`DROP INDEX "UQ_payments_gateway_order"`);
    await queryRunner.query(`DROP INDEX "UQ_dine_in_invoice_success_payment"`);
    await queryRunner.query(`DROP INDEX "UQ_dine_in_payment_idempotency"`);
    await queryRunner.query(`DROP INDEX "UQ_payments_reference"`);
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_cash_confirmer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_restaurant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_dine_in_session"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments"
        DROP COLUMN "cash_confirmed_by_user_id",
        DROP COLUMN "gateway_event_id",
        DROP COLUMN "failed_at",
        DROP COLUMN "completed_at",
        DROP COLUMN "initiated_at",
        DROP COLUMN "failure_code",
        DROP COLUMN "idempotency_key",
        DROP COLUMN "currency",
        DROP COLUMN "restaurant_id",
        DROP COLUMN "dine_in_session_id",
        DROP COLUMN "invoice_id",
        DROP COLUMN "payment_reference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "order_id" SET NOT NULL`,
    );
  }
}
