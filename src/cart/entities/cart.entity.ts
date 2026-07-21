import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { User } from '../../users/entities/user.entity';
import { CartItem } from './cart-item.entity';

@Entity({ name: 'carts' })
export class Cart {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'restaurant_id', type: 'uuid', nullable: true })
  restaurantId!: string | null;

  @ManyToOne(() => Restaurant, { nullable: true })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant!: Restaurant | null;

  @Column({ name: 'coupon_code', type: 'varchar', nullable: true })
  couponCode!: string | null;

  @OneToMany(() => CartItem, (item) => item.cart)
  items!: CartItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
