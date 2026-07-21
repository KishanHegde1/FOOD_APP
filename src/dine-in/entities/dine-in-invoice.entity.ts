import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DineInInvoiceStatus } from '../enums/dine-in-invoice-status.enum';

@Entity({ name: 'dine_in_invoices' })
export class DineInInvoice {
  @PrimaryGeneratedColumn('uuid', { name: 'id' }) id!: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 64 })
  invoiceNumber!: string;

  @Column({ name: 'dine_in_session_id', type: 'uuid' })
  dineInSessionId!: string;

  @Column({ name: 'restaurant_id', type: 'uuid' }) restaurantId!: string;

  @Column({ name: 'restaurant_table_id', type: 'uuid' })
  restaurantTableId!: string;

  @Column({ name: 'customer_user_id', type: 'uuid', nullable: true })
  customerUserId!: string | null;

  @Column({ name: 'status', type: 'varchar', length: 24 })
  status!: DineInInvoiceStatus;

  @Column({ name: 'subtotal_paise', type: 'integer' }) subtotalPaise!: number;

  @Column({ name: 'tax_paise', type: 'integer' }) taxPaise!: number;

  @Column({ name: 'service_charge_paise', type: 'integer' })
  serviceChargePaise!: number;

  @Column({ name: 'discount_paise', type: 'integer' })
  discountPaise!: number;

  @Column({ name: 'total_paise', type: 'integer' }) totalPaise!: number;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ name: 'item_count', type: 'integer' }) itemCount!: number;

  @Column({ name: 'order_count', type: 'integer' }) orderCount!: number;

  @Column({ name: 'billing_snapshot', type: 'jsonb' })
  billingSnapshot!: DineInBillingSnapshot;

  @Column({ name: 'requested_at', type: 'timestamptz' }) requestedAt!: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export type DineInBillingSnapshot = {
  sessionNumber?: string;
  restaurantName?: string;
  tableNumber?: string;
  requestHistory?: Array<{
    cancelledAt: string;
    reason: string | null;
    snapshot: Omit<DineInBillingSnapshot, 'requestHistory'>;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    roundNumber: number;
    status: string;
    createdAt: string;
    items: Array<{
      id: string;
      foodItemId: string | null;
      name: string;
      quantity: number;
      unitPricePaise: number;
      totalPricePaise: number;
    }>;
    pricing: {
      subtotalPaise: number;
      taxPaise: number;
      serviceChargePaise: number;
      discountPaise: number;
      totalPaise: number;
    };
  }>;
};
