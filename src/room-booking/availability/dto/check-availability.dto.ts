import { Type } from 'class-transformer';
import { IsDateString, IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckAvailabilityDto {
  @ApiProperty({ format: 'date', example: '2026-08-01' })
  @IsDateString()
  checkIn!: string;

  @ApiProperty({ format: 'date', example: '2026-08-04' })
  @IsDateString()
  checkOut!: string;

  @ApiProperty({ minimum: 1, maximum: 10, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  roomCount = 1;
}
