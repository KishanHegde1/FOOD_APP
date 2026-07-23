import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimStringTransform } from '../../common/utils/string-transform.util';

export class CreateReviewDto {
  @ApiProperty({
    format: 'uuid',
    description: "The caller's checked-out booking ID.",
  })
  @IsUUID('4')
  bookingId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @Transform(trimStringTransform)
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(trimStringTransform)
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
