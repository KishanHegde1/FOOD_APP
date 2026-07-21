import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class FirebaseLoginUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  firebaseUid!: string;

  @ApiProperty()
  phone!: string;

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

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLoginAt!: string | null;
}

export class FirebaseLoginResponseDto {
  @ApiProperty({ type: FirebaseLoginUserDto })
  user!: FirebaseLoginUserDto;
}
