import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DineInSessionStatus } from '../enums/dine-in-session-status.enum';

@Entity({ name: 'dine_in_sessions' })
export class DineInSession {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId!: string;

  @Column({ name: 'restaurant_table_id', type: 'uuid' })
  restaurantTableId!: string;

  @Column({ name: 'opened_by_user_id', type: 'uuid', nullable: true })
  openedByUserId!: string | null;

  @Column({ name: 'session_number', type: 'varchar' })
  sessionNumber!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DineInSessionStatus,
    enumName: 'dine_in_session_status',
    default: DineInSessionStatus.ACTIVE,
  })
  status!: DineInSessionStatus;

  @Column({ name: 'guest_count', type: 'integer', default: 1 })
  guestCount!: number;

  @Column({ name: 'current_round_number', type: 'integer', default: 0 })
  currentRoundNumber!: number;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'bill_requested_at', type: 'timestamptz', nullable: true })
  billRequestedAt!: Date | null;

  @Column({
    name: 'payment_completed_at',
    type: 'timestamptz',
    nullable: true,
  })
  paymentCompletedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'cancellation_reason', type: 'varchar', nullable: true })
  cancellationReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
