import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MenuCategoryOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderMenuCategoriesDto {
  @ApiProperty({ type: [MenuCategoryOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: MenuCategoryOrderItemDto) => item.id)
  @ValidateNested({ each: true })
  @Type(() => MenuCategoryOrderItemDto)
  items!: MenuCategoryOrderItemDto[];
}
