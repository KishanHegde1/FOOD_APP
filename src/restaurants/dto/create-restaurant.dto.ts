import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const transformBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  return value;
};

export class CreateRestaurantDto {
  @ApiProperty({ minLength: 2, maxLength: 180 })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s()-]{6,20}$/)
  phone?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsUrl()
  bannerUrl?: string;

  @ApiProperty({ maxLength: 5000 })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  addressLine!: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  locality?: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ default: 'India', maxLength: 80 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ minimum: 0, default: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  averageDeliveryMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryFeePaise?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumOrderPaise?: number;

  @ApiPropertyOptional({ minimum: 0.1, default: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsPositive()
  @Max(1000)
  serviceRadiusKm?: number;

  @ApiPropertyOptional({ default: false })
  @Transform(transformBoolean)
  @IsOptional()
  @IsBoolean()
  isPureVeg?: boolean;

  @ApiPropertyOptional({ example: '09:00' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Matches(TIME_FORMAT)
  openingTime?: string;

  @ApiPropertyOptional({ example: '22:30' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Matches(TIME_FORMAT)
  closingTime?: string;
}
