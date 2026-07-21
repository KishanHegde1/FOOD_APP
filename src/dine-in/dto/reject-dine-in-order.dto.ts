import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { trimString } from './dine-in-dto-transformers';

export class RejectDineInOrderDto {
  @ApiProperty({
    example: 'One or more items are unavailable.',
    maxLength: 500,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/^[^<>]*$/, { message: 'reason must not contain HTML markup.' })
  reason!: string;
}
