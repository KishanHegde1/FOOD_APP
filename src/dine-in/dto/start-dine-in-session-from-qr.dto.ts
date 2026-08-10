import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ResolveDineInQrPayloadDto } from './resolve-dine-in-qr-payload.dto';

export class StartDineInSessionFromQrDto extends ResolveDineInQrPayloadDto {
  @ApiProperty({ minimum: 1, maximum: 100, example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  guestCount!: number;
}
