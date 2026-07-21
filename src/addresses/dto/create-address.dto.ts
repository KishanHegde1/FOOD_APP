import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { strictBooleanTransform } from '../../common/transformers/strict-boolean.transformer';
import { AddressLabel } from '../entities/address.entity';

const normalizeWhitespace = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class CreateAddressDto {
  @ApiPropertyOptional({ enum: AddressLabel, default: AddressLabel.HOME })
  @IsOptional()
  @IsEnum(AddressLabel)
  label?: AddressLabel;

  @ApiProperty({ maxLength: 100 })
  @Transform(normalizeWhitespace)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  recipientName!: string;

  @ApiProperty({ example: '+919876543210' })
  @Transform(normalizeWhitespace)
  @IsString()
  @Matches(/^\+?[0-9][0-9\s()-]{5,19}$/)
  phone!: string;

  @ApiProperty({ maxLength: 500 })
  @Transform(normalizeWhitespace)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  addressLine!: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @Transform(normalizeWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  locality?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @Transform(normalizeWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  landmark?: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(normalizeWhitespace)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(normalizeWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiProperty({ maxLength: 20, example: '560038' })
  @Transform(normalizeWhitespace)
  @IsString()
  @Matches(/^[A-Za-z0-9 -]{3,20}$/)
  postalCode!: string;

  @ApiPropertyOptional({ default: 'India', maxLength: 80 })
  @Transform(normalizeWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ default: false })
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
