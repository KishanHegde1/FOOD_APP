import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from './dine-in-dto-transformers';

export class CreateDineInOrderItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() foodItemId!: string;
  @ApiProperty({ minimum: 1, maximum: 50, example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
  @ApiPropertyOptional({ maxLength: 250 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(250)
  specialInstructions?: string;
}

export class CreateDineInOrderDto {
  @ApiProperty({ type: [CreateDineInOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreateDineInOrderItemDto) => item.foodItemId)
  @ValidateNested({ each: true })
  @Type(() => CreateDineInOrderItemDto)
  items!: CreateDineInOrderItemDto[];
  @ApiProperty({
    example: '2b4db3f2-6c96-4b7d-a8d0-f59db534b52b',
    maxLength: 100,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  idempotencyKey!: string;
}
