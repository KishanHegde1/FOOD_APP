import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutPreviewDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Active delivery address owned by the authenticated customer.',
  })
  @IsUUID()
  deliveryAddressId!: string;
}
