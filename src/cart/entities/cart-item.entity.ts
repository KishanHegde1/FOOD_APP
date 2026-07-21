import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Food } from '../../foods/entities/food.entity';
import { Cart } from './cart.entity';

@Entity({ name: 'cart_items' })
export class CartItem {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'cart_id', type: 'uuid' })
  cartId!: string;

  @ManyToOne(() => Cart)
  @JoinColumn({ name: 'cart_id' })
  cart!: Cart;

  @Column({ name: 'food_item_id', type: 'uuid' })
  foodItemId!: string;

  @ManyToOne(() => Food)
  @JoinColumn({ name: 'food_item_id' })
  food!: Food;

  @Column({ name: 'quantity', type: 'integer', default: 1 })
  quantity!: number;

  @Column({ name: 'unit_price_paise', type: 'integer' })
  unitPricePaise!: number;

  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
