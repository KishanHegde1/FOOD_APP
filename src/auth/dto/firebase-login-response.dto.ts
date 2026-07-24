import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserGender, UserRole } from '../../users/entities/user.entity';

export class FirebaseLoginUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  phoneNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  fullName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profileImage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profilePhotoUrl!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  dateOfBirth!: string | null;

  @ApiPropertyOptional({ enum: UserGender, nullable: true })
  gender!: UserGender | null;

  @ApiProperty()
  isProfileComplete!: boolean;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  phoneVerified!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLoginAt!: string | null;
}

export class FirebaseLoginResponseDto {
  @ApiProperty({ type: FirebaseLoginUserDto })
  user!: FirebaseLoginUserDto;
}
