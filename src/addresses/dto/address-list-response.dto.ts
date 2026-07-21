import { ApiProperty } from '@nestjs/swagger';
import { AddressResponseDto } from './address-response.dto';

export class AddressListResponseDto {
  @ApiProperty({ type: [AddressResponseDto] })
  data!: AddressResponseDto[];
}
