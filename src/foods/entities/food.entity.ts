import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MenuCategory } from '../../menu-categories/entities/menu-category.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

@Entity({ name: 'food_items' })
export class Food {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId!: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant!: Restaurant;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => MenuCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: MenuCategory | null;

  @Column({ name: 'name', type: 'varchar', length: 180 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ name: 'price_paise', type: 'integer' })
  pricePaise!: number;

  @Column({ name: 'original_price_paise', type: 'integer', nullable: true })
  originalPricePaise!: number | null;

  @Column({ name: 'rating', type: 'numeric', default: 0 })
  rating!: number;

  @Column({ name: 'review_count', type: 'integer', default: 0 })
  reviewCount!: number;

  @Column({ name: 'preparation_minutes', type: 'integer', default: 15 })
  preparationMinutes!: number;

  @Column({ name: 'is_veg', type: 'boolean', default: true })
  isVeg!: boolean;

  @Column({ name: 'is_bestseller', type: 'boolean', default: false })
  isBestseller!: boolean;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
