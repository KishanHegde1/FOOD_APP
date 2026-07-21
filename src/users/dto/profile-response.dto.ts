import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User, UserRole } from '../entities/user.entity';

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  firebaseUid!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  phoneNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profileImage!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  phoneVerified!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  static fromEntity(user: User): UserProfileDto {
    return {
      id: user.id,
      firebaseUid: user.firebaseUid ?? '',
      phone: user.phone,
      phoneNumber: user.phone,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      role: user.role,
      phoneVerified: user.phoneVerified,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

export class ProfileDataDto {
  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;
}

export class ProfileResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: ProfileDataDto })
  data!: ProfileDataDto;

  static fromEntity(user: User, message: string): ProfileResponseDto {
    return {
      success: true,
      message,
      data: {
        user: UserProfileDto.fromEntity(user),
      },
    };
  }
}
