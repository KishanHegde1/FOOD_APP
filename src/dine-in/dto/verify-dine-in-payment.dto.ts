import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyDineInPaymentDto {
  @ApiProperty() @IsString() @MaxLength(128) gatewayOrderId!: string;
  @ApiProperty() @IsString() @MaxLength(128) gatewayPaymentId!: string;
  @ApiProperty() @IsString() @MaxLength(512) gatewaySignature!: string;
}
