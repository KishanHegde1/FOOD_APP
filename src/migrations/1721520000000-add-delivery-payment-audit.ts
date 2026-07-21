import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryPaymentAudit1721520000000 implements MigrationInterface {
  name = 'AddDeliveryPaymentAudit1721520000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_transaction_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "payment_id" uuid,
        "order_id" uuid,
        "user_id" uuid,
        "event_type" character varying(80) NOT NULL,
        "status_from" character varying(40),
        "status_to" character varying(40),
        "gateway" character varying(40),
        "gateway_order_id" character varying,
        "gateway_payment_id" character varying,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_transaction_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_transaction_logs_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_payment_transaction_logs_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_payment_transaction_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "gateway" character varying(40) NOT NULL,
        "event_id" character varying,
        "event_type" character varying(120) NOT NULL,
        "gateway_order_id" character varying,
        "gateway_payment_id" character varying,
        "payment_id" uuid,
        "processed" boolean NOT NULL DEFAULT false,
        "ignored_reason" text,
        "payload" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_webhook_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_webhook_events_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_transaction_logs_payment_created" ON "payment_transaction_logs" ("payment_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_transaction_logs_order_created" ON "payment_transaction_logs" ("order_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_webhook_events_gateway_event" ON "payment_webhook_events" ("gateway", "event_id") WHERE "event_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_webhook_events_payment_created" ON "payment_webhook_events" ("payment_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_delivery_payment_idempotency" ON "payments" ("user_id", "idempotency_key") WHERE "order_id" IS NOT NULL AND "invoice_id" IS NULL AND "dine_in_session_id" IS NULL AND "idempotency_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_delivery_order_success_payment" ON "payments" ("order_id") WHERE "order_id" IS NOT NULL AND "invoice_id" IS NULL AND "dine_in_session_id" IS NULL AND "status" IN ('PAID'::payment_status, 'SUCCESS'::payment_status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_payments_user_initiated" ON "payments" ("user_id", "initiated_at" DESC) WHERE "order_id" IS NOT NULL AND "invoice_id" IS NULL AND "dine_in_session_id" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_delivery_payments_user_initiated"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_delivery_order_success_payment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_delivery_payment_idempotency"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_webhook_events_payment_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_payment_webhook_events_gateway_event"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_transaction_logs_order_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_transaction_logs_payment_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_webhook_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_transaction_logs"`);
  }
}
