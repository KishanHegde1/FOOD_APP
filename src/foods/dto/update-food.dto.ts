import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFoodDto } from './create-food.dto';

export class UpdateFoodDto extends PartialType(
  OmitType(CreateFoodDto, ['restaurantId'] as const),
) {}
