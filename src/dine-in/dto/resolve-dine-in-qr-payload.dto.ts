import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { trimString } from './dine-in-dto-transformers';

export class ResolveDineInQrPayloadDto {
  @ApiProperty({
    example:
      'foodapp://dine-in?restaurantId=...&tableId=...&version=1&token=...',
    description: 'The raw text returned by the mobile QR scanner.',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  qrPayload!: string;
}
