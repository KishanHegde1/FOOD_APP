import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'User Name',
    minLength: 2,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+918888888888',
    description:
      'Optional E.164-like phone number. Firebase login still owns verification.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{6,15}$/, {
    message: 'phone must be a valid international phone number.',
  })
  phone?: string;
}
