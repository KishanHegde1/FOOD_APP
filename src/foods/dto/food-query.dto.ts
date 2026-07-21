import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum FoodSortBy {
  NAME = 'name',
  PRICE = 'price',
  RATING = 'rating',
  PREPARATION_TIME = 'preparationTime',
  SORT_ORDER = 'sortOrder',
  CREATED_AT = 'createdAt',
}

export enum FoodSortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

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

@ValidatorConstraint({ name: 'validFoodPriceRange', async: false })
export class ValidFoodPriceRangeConstraint implements ValidatorConstraintInterface {
  validate(
    maximumPricePaise: unknown,
    validationArguments: ValidationArguments,
  ): boolean {
    const dto = validationArguments.object as FoodQueryDto;
    return (
      maximumPricePaise === undefined ||
      dto.minimumPricePaise === undefined ||
      (typeof maximumPricePaise === 'number' &&
        maximumPricePaise >= dto.minimumPricePaise)
    );
  }

  defaultMessage(): string {
    return 'maximumPricePaise must be greater than or equal to minimumPricePaise.';
  }
}

export class FoodQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'true for vegetarian, false for non-vegetarian.',
  })
  @Transform(transformBoolean)
  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @ApiPropertyOptional({ description: 'Defaults to true for public lists.' })
  @Transform(transformBoolean)
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional()
  @Transform(transformBoolean)
  @IsOptional()
  @IsBoolean()
  isBestseller?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 5 })
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  @Max(5)
  minimumRating?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumPricePaise?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Validate(ValidFoodPriceRangeConstraint)
  maximumPricePaise?: number;

  @ApiPropertyOptional({
    enum: FoodSortBy,
    description: 'Defaults to bestseller, sort order, then name.',
  })
  @IsOptional()
  @IsEnum(FoodSortBy)
  sortBy?: FoodSortBy;

  @ApiPropertyOptional({ enum: FoodSortOrder, default: FoodSortOrder.ASC })
  @IsOptional()
  @IsEnum(FoodSortOrder)
  sortOrder: FoodSortOrder = FoodSortOrder.ASC;
}
