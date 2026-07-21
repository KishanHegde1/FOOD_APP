import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDineInInvoices1721347200000 implements MigrationInterface {
  name = 'CreateDineInInvoices1721347200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      CREATE TABLE "dine_in_invoices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "invoice_number" character varying(64) NOT NULL,
        "dine_in_session_id" uuid NOT NULL,
        "restaurant_id" uuid NOT NULL,
        "restaurant_table_id" uuid NOT NULL,
        "customer_user_id" uuid,
        "status" character varying(24) NOT NULL,
        "subtotal_paise" integer NOT NULL,
        "tax_paise" integer NOT NULL,
        "service_charge_paise" integer NOT NULL,
        "discount_paise" integer NOT NULL,
        "total_paise" integer NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'INR',
        "item_count" integer NOT NULL,
        "order_count" integer NOT NULL,
        "billing_snapshot" jsonb NOT NULL,
        "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "paid_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dine_in_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_dine_in_invoices_number" UNIQUE ("invoice_number"),
        CONSTRAINT "UQ_dine_in_invoices_session" UNIQUE ("dine_in_session_id"),
        CONSTRAINT "CHK_dine_in_invoices_status" CHECK ("status" IN ('REQUESTED', 'PAYMENT_PENDING', 'PAID', 'CANCELLED')),
        CONSTRAINT "FK_dine_in_invoices_session" FOREIGN KEY ("dine_in_session_id") REFERENCES "dine_in_sessions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_dine_in_invoices_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_dine_in_invoices_table" FOREIGN KEY ("restaurant_table_id") REFERENCES "restaurant_tables"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_dine_in_invoices_customer" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_dine_in_invoices_restaurant_requested" ON "dine_in_invoices" ("restaurant_id", "requested_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dine_in_invoices_customer_requested" ON "dine_in_invoices" ("customer_user_id", "requested_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "dine_in_invoices"');
  }
}
