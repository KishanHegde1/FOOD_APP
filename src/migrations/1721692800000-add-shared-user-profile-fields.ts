import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the existing shared users table for both delivery and hotel booking.
 * Existing canonical columns (name, phone, email, and profile_image) are
 * deliberately reused rather than duplicated.
 */
export class AddSharedUserProfileFields1721692800000 implements MigrationInterface {
  name = 'AddSharedUserProfileFields1721692800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_gender" AS ENUM (
          'MALE',
          'FEMALE',
          'NON_BINARY',
          'OTHER',
          'PREFER_NOT_TO_SAY'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" date',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" "user_gender"',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email_normalized" ON "users" (LOWER("email")) WHERE "email" IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_users_email_normalized"');
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "gender"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "date_of_birth"',
    );
    await queryRunner.query('DROP TYPE IF EXISTS "user_gender"');
  }
}
