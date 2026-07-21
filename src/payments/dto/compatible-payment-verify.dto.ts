import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompatiblePaymentVerifyDto {
  @ApiPropertyOptional({ example: 'order_Nxxxxxxx' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  razorpayOrderId?: string;

  @ApiPropertyOptional({ example: 'pay_Nxxxxxxx' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  razorpayPaymentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  razorpaySignature?: string;

  @ApiPropertyOptional({ example: 'order_Nxxxxxxx' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  gatewayOrderId?: string;

  @ApiPropertyOptional({ example: 'pay_Nxxxxxxx' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  gatewayPaymentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  gatewaySignature?: string;
}
