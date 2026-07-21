import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DineInOrderStatus } from '../enums/dine-in-order-status.enum';

export class DineInSessionOrdersQueryDto {
  @ApiPropertyOptional({ enum: DineInOrderStatus })
  @IsOptional()
  @IsEnum(DineInOrderStatus)
  status?: DineInOrderStatus;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value !== 'false')
  @IsBoolean()
  includeItems = true;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
