import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the standalone hotel room-booking domain. It intentionally does not
 * modify existing delivery, dine-in, payment, or users tables.
 */
export class CreateRoomBooking1721606400000 implements MigrationInterface {
  name = 'CreateRoomBooking1721606400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await this.createEnums(queryRunner);

    await queryRunner.query(`
      CREATE TABLE "hotels" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(180) NOT NULL,
        "description" text,
        "hotel_type" "hotel_type" NOT NULL,
        "star_rating" smallint NOT NULL DEFAULT 0,
        "average_rating" numeric(3,2) NOT NULL DEFAULT 0,
        "review_count" integer NOT NULL DEFAULT 0,
        "address_line" text NOT NULL,
        "locality" character varying(150),
        "city" character varying(120) NOT NULL,
        "state" character varying(120),
        "country" character varying(80) NOT NULL DEFAULT 'India',
        "postal_code" character varying(20),
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "check_in_time" time,
        "check_out_time" time,
        "policies" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "tax_percentage" numeric(5,2) NOT NULL DEFAULT 0,
        "currency" character varying(3) NOT NULL DEFAULT 'INR',
        "is_active" boolean NOT NULL DEFAULT true,
        "is_featured" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotels" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_hotels_star_rating" CHECK ("star_rating" BETWEEN 0 AND 5),
        CONSTRAINT "CHK_hotels_average_rating" CHECK ("average_rating" BETWEEN 0 AND 5),
        CONSTRAINT "CHK_hotels_review_count" CHECK ("review_count" >= 0),
        CONSTRAINT "CHK_hotels_tax_percentage" CHECK ("tax_percentage" >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotels_active_city" ON "hotels" ("is_active", "city")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_hotels_featured_active" ON "hotels" ("is_featured") WHERE "is_active" = true',
    );

    await queryRunner.query(`
      CREATE TABLE "hotel_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotel_id" uuid NOT NULL,
        "image_url" text NOT NULL,
        "alt_text" character varying(180),
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_images" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hotel_images_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_images_hotel_order" ON "hotel_images" ("hotel_id", "sort_order")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_hotel_images_primary" ON "hotel_images" ("hotel_id") WHERE "is_primary" = true',
    );

    await queryRunner.query(`
      CREATE TABLE "hotel_amenities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(120) NOT NULL,
        "icon" character varying(120),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_amenities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hotel_amenities_name" UNIQUE ("name")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "hotel_amenity_links" (
        "hotel_id" uuid NOT NULL,
        "amenity_id" uuid NOT NULL,
        CONSTRAINT "PK_hotel_amenity_links" PRIMARY KEY ("hotel_id", "amenity_id"),
        CONSTRAINT "FK_hotel_amenity_links_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hotel_amenity_links_amenity" FOREIGN KEY ("amenity_id") REFERENCES "hotel_amenities"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_amenity_links_amenity" ON "hotel_amenity_links" ("amenity_id", "hotel_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "hotel_rooms" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotel_id" uuid NOT NULL,
        "name" character varying(180) NOT NULL,
        "description" text,
        "room_type" "room_type" NOT NULL,
        "bed_type" "bed_type" NOT NULL,
        "max_adults" smallint NOT NULL,
        "max_children" smallint NOT NULL DEFAULT 0,
        "room_size_sqft" integer,
        "base_price" numeric(12,2) NOT NULL,
        "tax_percentage" numeric(5,2),
        "currency" character varying(3) NOT NULL DEFAULT 'INR',
        "cancellation_policy" jsonb NOT NULL DEFAULT '{"refundable": true, "freeCancellationHours": 24}'::jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_rooms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hotel_rooms_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_hotel_rooms_occupancy" CHECK ("max_adults" > 0 AND "max_children" >= 0),
        CONSTRAINT "CHK_hotel_rooms_price" CHECK ("base_price" >= 0),
        CONSTRAINT "CHK_hotel_rooms_tax" CHECK ("tax_percentage" IS NULL OR "tax_percentage" >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_rooms_active_hotel" ON "hotel_rooms" ("hotel_id", "is_active")',
    );

    await queryRunner.query(`
      CREATE TABLE "room_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "room_id" uuid NOT NULL,
        "image_url" text NOT NULL,
        "alt_text" character varying(180),
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_images" PRIMARY KEY ("id"),
        CONSTRAINT "FK_room_images_room" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_room_images_room_order" ON "room_images" ("room_id", "sort_order")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_room_images_primary" ON "room_images" ("room_id") WHERE "is_primary" = true',
    );

    await queryRunner.query(`
      CREATE TABLE "room_amenities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(120) NOT NULL,
        "icon" character varying(120),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_amenities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_room_amenities_name" UNIQUE ("name")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "room_amenity_links" (
        "room_id" uuid NOT NULL,
        "amenity_id" uuid NOT NULL,
        CONSTRAINT "PK_room_amenity_links" PRIMARY KEY ("room_id", "amenity_id"),
        CONSTRAINT "FK_room_amenity_links_room" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_room_amenity_links_amenity" FOREIGN KEY ("amenity_id") REFERENCES "room_amenities"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_room_amenity_links_amenity" ON "room_amenity_links" ("amenity_id", "room_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "room_inventory" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "room_id" uuid NOT NULL,
        "inventory_date" date NOT NULL,
        "total_inventory" integer NOT NULL,
        "reserved_inventory" integer NOT NULL DEFAULT 0,
        "blocked_inventory" integer NOT NULL DEFAULT 0,
        "price_override" numeric(12,2),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_inventory" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_room_inventory_room_date" UNIQUE ("room_id", "inventory_date"),
        CONSTRAINT "FK_room_inventory_room" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_room_inventory_counts" CHECK (
          "total_inventory" >= 0 AND "reserved_inventory" >= 0 AND "blocked_inventory" >= 0
          AND "reserved_inventory" + "blocked_inventory" <= "total_inventory"
        ),
        CONSTRAINT "CHK_room_inventory_price" CHECK ("price_override" IS NULL OR "price_override" >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_room_inventory_room_date" ON "room_inventory" ("room_id", "inventory_date")',
    );

    await queryRunner.query(`
      CREATE TABLE "hotel_bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_number" character varying(40) NOT NULL,
        "user_id" uuid NOT NULL,
        "hotel_id" uuid NOT NULL,
        "room_id" uuid NOT NULL,
        "check_in_date" date NOT NULL,
        "check_out_date" date NOT NULL,
        "number_of_nights" integer NOT NULL,
        "room_count" integer NOT NULL,
        "adult_count" integer NOT NULL,
        "child_count" integer NOT NULL DEFAULT 0,
        "contact_name" character varying(120) NOT NULL,
        "contact_phone" character varying(20) NOT NULL,
        "contact_email" character varying(255),
        "special_requests" text,
        "payment_method" "hotel_payment_method" NOT NULL,
        "payment_status" "hotel_payment_status" NOT NULL,
        "booking_status" "hotel_booking_status" NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'INR',
        "nightly_price_breakdown" jsonb NOT NULL,
        "subtotal" numeric(12,2) NOT NULL,
        "tax_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "discount_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "total_amount" numeric(12,2) NOT NULL,
        "cancellation_reason" text,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "checked_in_at" TIMESTAMP WITH TIME ZONE,
        "checked_out_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hotel_bookings_number" UNIQUE ("booking_number"),
        CONSTRAINT "FK_hotel_bookings_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_hotel_bookings_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_hotel_bookings_room" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_hotel_bookings_dates" CHECK ("check_out_date" > "check_in_date"),
        CONSTRAINT "CHK_hotel_bookings_counts" CHECK ("number_of_nights" > 0 AND "room_count" > 0 AND "adult_count" > 0 AND "child_count" >= 0),
        CONSTRAINT "CHK_hotel_bookings_money" CHECK ("subtotal" >= 0 AND "tax_amount" >= 0 AND "discount_amount" >= 0 AND "total_amount" >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_bookings_user_created" ON "hotel_bookings" ("user_id", "created_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_bookings_hotel_status" ON "hotel_bookings" ("hotel_id", "booking_status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_bookings_room_stay" ON "hotel_bookings" ("room_id", "check_in_date", "check_out_date")',
    );

    await queryRunner.query(`
      CREATE TABLE "booking_guests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "full_name" character varying(120) NOT NULL,
        "age" smallint,
        "is_primary_guest" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_guests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_guests_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_booking_guests_age" CHECK ("age" IS NULL OR "age" BETWEEN 0 AND 120)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_booking_guests_booking" ON "booking_guests" ("booking_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "hotel_favourites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "hotel_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_favourites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hotel_favourites_user_hotel" UNIQUE ("user_id", "hotel_id"),
        CONSTRAINT "FK_hotel_favourites_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hotel_favourites_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_favourites_user_created" ON "hotel_favourites" ("user_id", "created_at" DESC)',
    );

    await queryRunner.query(`
      CREATE TABLE "hotel_reviews" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotel_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "title" character varying(160),
        "comment" text,
        "is_approved" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hotel_reviews_booking" UNIQUE ("booking_id"),
        CONSTRAINT "FK_hotel_reviews_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hotel_reviews_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hotel_reviews_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_hotel_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_reviews_hotel_approved_created" ON "hotel_reviews" ("hotel_id", "created_at" DESC) WHERE "is_approved" = true',
    );

    await queryRunner.query(`
      CREATE TABLE "booking_status_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "status" "hotel_booking_status" NOT NULL,
        "changed_by_user_id" uuid,
        "reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_status_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_status_history_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_booking_status_history_user" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_booking_status_history_booking_created" ON "booking_status_history" ("booking_id", "created_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "booking_status_history"');
    await queryRunner.query('DROP TABLE IF EXISTS "hotel_reviews"');
    await queryRunner.query('DROP TABLE IF EXISTS "hotel_favourites"');
    await queryRunner.query('DROP TABLE IF EXISTS "booking_guests"');
    await queryRunner.query('DROP TABLE IF EXISTS "hotel_bookings"');
    await queryRunner.query('DROP TABLE IF EXISTS "room_inventory"');
    await queryRunner.query('DROP TABLE IF EXISTS "room_amenity_links"');
    await queryRunner.query('DROP TABLE IF EXISTS "room_amenities"');
    await queryRunner.query('DROP TABLE IF EXISTS "room_images"');
    await queryRunner.query('DROP TABLE IF EXISTS "hotel_rooms"');
    await queryRunner.query('DROP TABLE IF EXISTS "hotel_amenity_links"');
    await queryRunner.query('DROP TABLE IF EXISTS "hotel_amenities"');
    await queryRunner.query('DROP TABLE IF EXISTS "hotel_images"');
    await queryRunner.query('DROP TABLE IF EXISTS "hotels"');
    await queryRunner.query('DROP TYPE IF EXISTS "hotel_payment_status"');
    await queryRunner.query('DROP TYPE IF EXISTS "hotel_payment_method"');
    await queryRunner.query('DROP TYPE IF EXISTS "hotel_booking_status"');
    await queryRunner.query('DROP TYPE IF EXISTS "bed_type"');
    await queryRunner.query('DROP TYPE IF EXISTS "room_type"');
    await queryRunner.query('DROP TYPE IF EXISTS "hotel_type"');
  }

  private async createEnums(queryRunner: QueryRunner): Promise<void> {
    const enums = [
      [
        'hotel_type',
        "'HOTEL', 'RESORT', 'VILLA', 'APARTMENT', 'HOSTEL', 'GUEST_HOUSE', 'HOMESTAY'",
      ],
      [
        'room_type',
        "'STANDARD', 'DELUXE', 'SUPER_DELUXE', 'SUITE', 'FAMILY', 'DORMITORY', 'VILLA', 'APARTMENT'",
      ],
      [
        'bed_type',
        "'SINGLE', 'DOUBLE', 'QUEEN', 'KING', 'TWIN', 'BUNK', 'SOFA_BED'",
      ],
      [
        'hotel_booking_status',
        "'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'EXPIRED', 'REJECTED'",
      ],
      [
        'hotel_payment_status',
        "'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'PAY_AT_HOTEL'",
      ],
      [
        'hotel_payment_method',
        "'ONLINE', 'UPI', 'CARD', 'NET_BANKING', 'WALLET', 'PAY_AT_HOTEL'",
      ],
    ] as const;

    for (const [name, values] of enums) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "${name}" AS ENUM (${values});
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }
  }
}
