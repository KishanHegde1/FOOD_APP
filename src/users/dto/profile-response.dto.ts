import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User, UserGender, UserRole } from '../entities/user.entity';

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  fullName!: string | null;

  @ApiProperty()
  phoneNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profilePhotoUrl!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  dateOfBirth!: string | null;

  @ApiPropertyOptional({ enum: UserGender, nullable: true })
  gender!: UserGender | null;

  @ApiProperty({
    description: 'True when full name, email, and phone number are present.',
  })
  isProfileComplete!: boolean;

  @ApiPropertyOptional({ deprecated: true, nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ deprecated: true })
  phone!: string;

  @ApiPropertyOptional({ deprecated: true, nullable: true })
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
      fullName: user.name,
      phoneNumber: user.phone,
      email: user.email,
      profilePhotoUrl: user.profileImage,
      dateOfBirth: UserProfileDto.toIsoDate(user.dateOfBirth),
      gender: user.gender ?? null,
      isProfileComplete: UserProfileDto.isProfileComplete(user),
      name: user.name,
      phone: user.phone,
      profileImage: user.profileImage,
      role: user.role,
      phoneVerified: user.phoneVerified,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private static isProfileComplete(user: User): boolean {
    return Boolean(
      user.name?.trim() && user.email?.trim() && user.phone?.trim(),
    );
  }

  private static toIsoDate(
    value: string | Date | null | undefined,
  ): string | null {
    if (!value) return null;
    return typeof value === 'string' ? value : value.toISOString().slice(0, 10);
  }
}

export { UserProfileDto as CurrentUserProfileResponseDto };

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
