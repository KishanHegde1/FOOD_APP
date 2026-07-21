import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { CheckoutPreviewDto } from './dto/checkout-preview.dto';
import { CheckoutPreviewResponseDto } from './dto/checkout-preview-response.dto';
import { CheckoutService } from './checkout.service';

@ApiTags('Checkout')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly usersService: UsersService,
  ) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Preview trusted cart pricing and checkout blockers without creating an order',
  })
  @ApiOkResponse({ type: CheckoutPreviewResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid address ID or an empty cart.',
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only active customers can preview checkout.',
  })
  @ApiNotFoundResponse({ description: 'Address not found.' })
  async preview(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: CheckoutPreviewDto,
  ): Promise<CheckoutPreviewResponseDto> {
    return this.checkoutService.preview(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }
}
