import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DineInOrderStatus } from '../enums/dine-in-order-status.enum';

export enum DineInKitchenStatusUpdate {
  PREPARING = DineInOrderStatus.PREPARING,
  READY = DineInOrderStatus.READY,
  SERVED = DineInOrderStatus.SERVED,
}

export class UpdateDineInKitchenStatusDto {
  @ApiProperty({
    enum: DineInKitchenStatusUpdate,
    description:
      'Kitchen workflow only progresses from APPROVED to PREPARING to READY to SERVED.',
  })
  @IsEnum(DineInKitchenStatusUpdate)
  status!: DineInKitchenStatusUpdate;
}
