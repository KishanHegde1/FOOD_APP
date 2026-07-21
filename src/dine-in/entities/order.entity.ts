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
import { DineInOrderStatus } from '../enums/dine-in-order-status.enum';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '../enums/order.enums';
import { DineInSession } from './dine-in-session.entity';
import { OrderItem } from './order-item.entity';
import { RestaurantTable } from './restaurant-table.entity';

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid', { name: 'id' }) id!: string;
  @Column({ name: 'order_number', type: 'varchar', length: 40 })
  orderNumber!: string;
  @Column({ name: 'customer_id', type: 'uuid' }) customerId!: string;
  @Column({ name: 'restaurant_id', type: 'uuid' }) restaurantId!: string;
  @Column({ name: 'delivery_partner_id', type: 'uuid', nullable: true })
  deliveryPartnerId!: string | null;
  @Column({ name: 'delivery_address_id', type: 'uuid', nullable: true })
  deliveryAddressId!: string | null;
  @Column({ name: 'recipient_name_snapshot', type: 'varchar', length: 120 })
  recipientNameSnapshot!: string;
  @Column({ name: 'recipient_phone_snapshot', type: 'varchar', length: 20 })
  recipientPhoneSnapshot!: string;
  @Column({ name: 'delivery_address_snapshot', type: 'text' })
  deliveryAddressSnapshot!: string;
  @Column({ name: 'delivery_latitude', type: 'numeric', nullable: true })
  deliveryLatitude!: number | null;
  @Column({ name: 'delivery_longitude', type: 'numeric', nullable: true })
  deliveryLongitude!: number | null;
  @Column({ name: 'item_total_paise', type: 'integer' })
  itemTotalPaise!: number;
  @Column({ name: 'delivery_fee_paise', type: 'integer', default: 0 })
  deliveryFeePaise!: number;
  @Column({ name: 'platform_fee_paise', type: 'integer', default: 0 })
  platformFeePaise!: number;
  @Column({ name: 'tax_paise', type: 'integer', default: 0 }) taxPaise!: number;
  @Column({ name: 'discount_paise', type: 'integer', default: 0 })
  discountPaise!: number;
  @Column({ name: 'grand_total_paise', type: 'integer' })
  grandTotalPaise!: number;
  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method',
  })
  paymentMethod!: PaymentMethod;
  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
    default: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;
  @Column({
    name: 'order_status',
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    default: OrderStatus.PLACED,
  })
  orderStatus!: OrderStatus;
  @Column({ name: 'coupon_code', type: 'varchar', length: 50, nullable: true })
  couponCode!: string | null;
  @Column({ name: 'delivery_instructions', type: 'text', nullable: true })
  deliveryInstructions!: string | null;
  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason!: string | null;
  @Column({
    name: 'estimated_delivery_at',
    type: 'timestamptz',
    nullable: true,
  })
  estimatedDeliveryAt!: Date | null;
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;
  @Column({ name: 'prepared_at', type: 'timestamptz', nullable: true })
  preparedAt!: Date | null;
  @Column({ name: 'picked_up_at', type: 'timestamptz', nullable: true })
  pickedUpAt!: Date | null;
  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;
  @Column({
    name: 'order_type',
    type: 'enum',
    enum: OrderType,
    enumName: 'order_type',
    default: OrderType.DELIVERY,
  })
  orderType!: OrderType;
  @Column({ name: 'dine_in_session_id', type: 'uuid', nullable: true })
  dineInSessionId!: string | null;
  @ManyToOne(() => DineInSession, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dine_in_session_id' })
  dineInSession?: DineInSession | null;
  @Column({ name: 'restaurant_table_id', type: 'uuid', nullable: true })
  restaurantTableId!: string | null;
  @ManyToOne(() => RestaurantTable, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'restaurant_table_id' })
  restaurantTable?: RestaurantTable | null;
  @Column({ name: 'order_round_number', type: 'integer', nullable: true })
  orderRoundNumber!: number | null;
  @Column({
    name: 'dine_in_status',
    type: 'enum',
    enum: DineInOrderStatus,
    enumName: 'dine_in_order_status',
    nullable: true,
  })
  dineInStatus!: DineInOrderStatus | null;
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;
  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt!: Date | null;
  @Column({
    name: 'preparation_started_at',
    type: 'timestamptz',
    nullable: true,
  })
  preparationStartedAt!: Date | null;
  @Column({ name: 'ready_at', type: 'timestamptz', nullable: true })
  readyAt!: Date | null;
  @Column({ name: 'served_at', type: 'timestamptz', nullable: true })
  servedAt!: Date | null;
  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rejectionReason!: string | null;
  @OneToMany(() => OrderItem, (item) => item.order) items?: OrderItem[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
