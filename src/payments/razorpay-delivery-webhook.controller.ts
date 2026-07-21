import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import type { RazorpayDeliveryWebhookPayload } from './payments.service';

@ApiTags('Payment Webhooks')
@Controller('webhooks/razorpay/delivery')
export class RazorpayDeliveryWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Receive signed Razorpay webhooks for delivery payments',
  })
  @ApiNoContentResponse({ description: 'Webhook processed or ignored safely.' })
  @ApiBadRequestResponse({ description: 'Raw request body unavailable.' })
  @ApiForbiddenResponse({ description: 'WEBHOOK_SIGNATURE_INVALID.' })
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Headers('x-razorpay-event-id') eventId: string | undefined,
    @Body() payload: RazorpayDeliveryWebhookPayload,
  ): Promise<void> {
    if (!request.rawBody || !signature) {
      throw new BadRequestException('WEBHOOK_SIGNATURE_INVALID');
    }
    await this.paymentsService.handleRazorpayWebhook({
      rawBody: request.rawBody.toString('utf8'),
      signature,
      eventId,
      payload,
    });
  }
}
