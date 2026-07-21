import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DineInMemberRole } from '../enums/dine-in-member-role.enum';

@Entity({ name: 'dine_in_session_members' })
export class DineInSessionMember {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'dine_in_session_id', type: 'uuid' })
  dineInSessionId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    name: 'member_role',
    type: 'enum',
    enum: DineInMemberRole,
    enumName: 'dine_in_member_role',
    default: DineInMemberRole.GUEST,
  })
  memberRole!: DineInMemberRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
