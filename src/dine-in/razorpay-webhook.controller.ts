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
import type { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DineInPaymentsService } from './dine-in-payments.service';
import type { RazorpayWebhookPayload } from './dine-in-payments.service';

@ApiTags('Payment Webhooks')
@Controller('webhooks/razorpay')
export class RazorpayWebhookController {
  constructor(private readonly paymentsService: DineInPaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Receive a signed Razorpay payment webhook (no Firebase authentication)',
  })
  @ApiNoContentResponse({ description: 'Webhook safely processed or ignored.' })
  @ApiBadRequestResponse({ description: 'Raw request body unavailable.' })
  @ApiForbiddenResponse({ description: 'WEBHOOK_SIGNATURE_INVALID.' })
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Headers('x-razorpay-event-id') eventId: string | undefined,
    @Body() payload: RazorpayWebhookPayload,
  ): Promise<void> {
    if (!request.rawBody || !signature)
      throw new BadRequestException('WEBHOOK_SIGNATURE_INVALID');
    await this.paymentsService.handleRazorpayWebhook({
      rawBody: request.rawBody.toString('utf8'),
      signature,
      eventId,
      payload,
    });
  }
}
