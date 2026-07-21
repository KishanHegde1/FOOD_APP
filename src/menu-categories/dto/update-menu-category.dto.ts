import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateMenuCategoryDto } from './create-menu-category.dto';

export class UpdateMenuCategoryDto extends PartialType(
  OmitType(CreateMenuCategoryDto, ['restaurantId'] as const),
) {
  @ApiPropertyOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) {
      return true;
    }
    if (value === 'false' || value === false) {
      return false;
    }
    return value;
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
