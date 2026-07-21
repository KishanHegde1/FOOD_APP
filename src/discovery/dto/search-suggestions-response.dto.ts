import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SearchSuggestionType {
  RESTAURANT = 'restaurant',
  FOOD = 'food',
}

export class SearchSuggestionDto {
  @ApiProperty({ enum: SearchSuggestionType })
  type!: SearchSuggestionType;

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  restaurantId?: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  subtitle!: string;
}

export class SearchSuggestionsResponseDto {
  @ApiProperty({ type: [SearchSuggestionDto] })
  suggestions!: SearchSuggestionDto[];
}
