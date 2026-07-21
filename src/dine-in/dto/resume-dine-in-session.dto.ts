import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResumeDineInSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sessionId!: string;
}
