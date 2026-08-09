import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFoodServiceWindows1721865600000 implements MigrationInterface {
  name = 'AddFoodServiceWindows1721865600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "food_items"
        ADD COLUMN IF NOT EXISTS "available_from_time" time,
        ADD COLUMN IF NOT EXISTS "available_until_time" time
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "food_items"
        DROP COLUMN IF EXISTS "available_until_time",
        DROP COLUMN IF EXISTS "available_from_time"
    `);
  }
}
