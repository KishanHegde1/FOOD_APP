import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { strictBooleanTransform } from '../../common/transformers/strict-boolean.transformer';

export class AddCartItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  foodItemId!: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity = 1;

  @ApiPropertyOptional({
    default: false,
    description:
      'Clear a cart from another restaurant before adding this item.',
  })
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  replaceCart = false;
}
