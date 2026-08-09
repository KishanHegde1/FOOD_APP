import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

@ValidatorConstraint({ name: 'validFoodOriginalPrice', async: false })
export class ValidFoodOriginalPriceConstraint implements ValidatorConstraintInterface {
  validate(
    originalPricePaise: unknown,
    validationArguments: ValidationArguments,
  ): boolean {
    if (originalPricePaise === undefined || originalPricePaise === null) {
      return true;
    }

    const dto = validationArguments.object as CreateFoodDto;
    if (dto.pricePaise === undefined) {
      return true;
    }

    return (
      typeof originalPricePaise === 'number' &&
      typeof dto.pricePaise === 'number' &&
      originalPricePaise >= dto.pricePaise
    );
  }

  defaultMessage(): string {
    return 'originalPricePaise must be greater than or equal to pricePaise.';
  }
}

export class CreateFoodDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  restaurantId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

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

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ example: 19900, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricePaise!: number;

  @ApiPropertyOptional({ example: 24900, minimum: 0, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Validate(ValidFoodOriginalPriceConstraint)
  originalPricePaise?: number | null;

  @ApiPropertyOptional({ default: 15, minimum: 0, maximum: 300 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  preparationMinutes?: number;

  @ApiProperty({
    description: 'true for vegetarian food, false for non-vegetarian food.',
  })
  @Transform(transformBoolean)
  @IsBoolean()
  isVeg!: boolean;

  @ApiPropertyOptional({ default: false })
  @Transform(transformBoolean)
  @IsOptional()
  @IsBoolean()
  isBestseller?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    example: '12:00',
    description:
      'Optional daily local-time availability start in 24-hour HH:mm format. Set both time fields or neither.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'availableFromTime must use HH:mm format.',
  })
  availableFromTime?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '15:00',
    description:
      'Optional daily local-time availability end in 24-hour HH:mm format. Set both time fields or neither.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'availableUntilTime must use HH:mm format.',
  })
  availableUntilTime?: string | null;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
