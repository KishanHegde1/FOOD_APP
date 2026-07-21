import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const normalizeWhitespace = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class SearchSuggestionsQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(normalizeWhitespace)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(normalizeWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ default: 8, minimum: 1, maximum: 15 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15)
  limit = 8;
}
