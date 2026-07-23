import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  RESTAURANT_OWNER = 'RESTAURANT_OWNER',
  DELIVERY_PARTNER = 'DELIVERY_PARTNER',
  ADMIN = 'ADMIN',
}

export enum UserGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  NON_BINARY = 'NON_BINARY',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({
    name: 'firebase_uid',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  firebaseUid!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone!: string;

  @Column({ name: 'name', type: 'varchar', length: 120, nullable: true })
  name!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'profile_image', type: 'text', nullable: true })
  profileImage!: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: string | null;

  @Column({
    name: 'gender',
    type: 'enum',
    enum: UserGender,
    enumName: 'user_gender',
    nullable: true,
  })
  gender?: UserGender | null;

  @Column({ name: 'role', type: 'enum', enum: UserRole, enumName: 'user_role' })
  role!: UserRole;

  @Column({ name: 'is_active', type: 'boolean' })
  isActive!: boolean;

  @Column({ name: 'phone_verified', type: 'boolean' })
  phoneVerified!: boolean;

  @Column({ name: 'email_verified', type: 'boolean' })
  emailVerified!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
