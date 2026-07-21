import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { trimString } from './dine-in-dto-transformers';

export class ValidateDineInQrDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  restaurantId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tableId!: string;

  @ApiProperty({
    description: 'Raw QR token. It is hashed immediately and never stored.',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 2147483647 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  version!: number;
}
