import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ValidateDineInQrDto } from './validate-dine-in-qr.dto';

export class StartDineInSessionDto extends ValidateDineInQrDto {
  @ApiProperty({ minimum: 1, maximum: 100, example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  guestCount!: number;
}
