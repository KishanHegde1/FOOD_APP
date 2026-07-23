import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HotelBookingStatus } from '../../common/enums/room-booking.enums';

export class BookingQueryDto {
  @ApiPropertyOptional({ enum: HotelBookingStatus })
  @IsOptional()
  @IsEnum(HotelBookingStatus)
  status?: HotelBookingStatus;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
