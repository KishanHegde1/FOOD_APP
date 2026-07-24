import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomBookingRazorpayPayments1721779200000 implements MigrationInterface {
  name = 'AddRoomBookingRazorpayPayments1721779200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(
      `ALTER TYPE "hotel_payment_method" ADD VALUE IF NOT EXISTS 'RAZORPAY'`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_booking_payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "payment_reference" character varying(64) NOT NULL,
        "booking_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "payment_method" "hotel_payment_method" NOT NULL,
        "status" "hotel_payment_status" NOT NULL,
        "amount_paise" integer NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'INR',
        "gateway" character varying(40) NOT NULL,
        "gateway_order_id" character varying,
        "gateway_payment_id" character varying,
        "gateway_signature" text,
        "gateway_event_id" character varying,
        "idempotency_key" character varying(128) NOT NULL,
        "failure_code" character varying,
        "failure_reason" text,
        "initiated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "paid_at" TIMESTAMP WITH TIME ZONE,
        "failed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_booking_payments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hotel_booking_payments_reference" UNIQUE ("payment_reference"),
        CONSTRAINT "FK_hotel_booking_payments_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_hotel_booking_payments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_hotel_booking_payments_amount" CHECK ("amount_paise" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_booking_payments_user_idempotency" ON "hotel_booking_payments" ("user_id", "idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_booking_payments_gateway_order" ON "hotel_booking_payments" ("gateway_order_id") WHERE "gateway_order_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_booking_payments_gateway_payment" ON "hotel_booking_payments" ("gateway_payment_id") WHERE "gateway_payment_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_booking_success_payment" ON "hotel_booking_payments" ("booking_id") WHERE "status" = 'PAID'::hotel_payment_status`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_hotel_booking_payments_booking_created" ON "hotel_booking_payments" ("booking_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_hotel_booking_payments_user_created" ON "hotel_booking_payments" ("user_id", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_booking_payment_transaction_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "payment_id" uuid,
        "booking_id" uuid,
        "user_id" uuid,
        "event_type" character varying(80) NOT NULL,
        "status_from" character varying(40),
        "status_to" character varying(40),
        "gateway" character varying(40),
        "gateway_order_id" character varying,
        "gateway_payment_id" character varying,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_booking_payment_transaction_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hotel_booking_payment_logs_payment" FOREIGN KEY ("payment_id") REFERENCES "hotel_booking_payments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_hotel_booking_payment_logs_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_hotel_booking_payment_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_hotel_booking_payment_logs_payment_created" ON "hotel_booking_payment_transaction_logs" ("payment_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_hotel_booking_payment_logs_booking_created" ON "hotel_booking_payment_transaction_logs" ("booking_id", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_booking_payment_webhook_events" (
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
        CONSTRAINT "PK_hotel_booking_payment_webhook_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hotel_booking_payment_webhooks_payment" FOREIGN KEY ("payment_id") REFERENCES "hotel_booking_payments"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_booking_payment_webhooks_gateway_event" ON "hotel_booking_payment_webhook_events" ("gateway", "event_id") WHERE "event_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_hotel_booking_payment_webhooks_payment_created" ON "hotel_booking_payment_webhook_events" ("payment_id", "created_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_hotel_booking_payment_webhooks_payment_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_hotel_booking_payment_webhooks_gateway_event"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "hotel_booking_payment_webhook_events"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_hotel_booking_payment_logs_booking_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_hotel_booking_payment_logs_payment_created"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "hotel_booking_payment_transaction_logs"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_hotel_booking_payments_user_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_hotel_booking_payments_booking_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_hotel_booking_success_payment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_hotel_booking_payments_gateway_payment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_hotel_booking_payments_gateway_order"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_hotel_booking_payments_user_idempotency"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_booking_payments"`);
    // PostgreSQL enum values cannot be removed safely. RAZORPAY remains valid.
  }
}
