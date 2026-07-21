import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from './dine-in-dto-transformers';

export class CreateRestaurantTableDto {
  @ApiProperty({ example: 'T01', maxLength: 50 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tableNumber!: string;

  @ApiPropertyOptional({ example: 'Table 1', maxLength: 120 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiProperty({ minimum: 1, maximum: 100, example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity!: number;
}
