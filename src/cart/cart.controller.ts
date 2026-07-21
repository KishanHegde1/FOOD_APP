import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
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
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('Cart')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated customer cart' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only active customers can use a cart.',
  })
  async getCurrentCart(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<CartResponseDto> {
    return this.cartService.getCurrentCart(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
    );
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an available food item to the customer cart' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid item or quantity.' })
  @ApiConflictResponse({
    description:
      'The cart belongs to another restaurant or the item is unavailable.',
  })
  @ApiNotFoundResponse({ description: 'Food item not found.' })
  async addItem(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.addItem(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }

  @Patch('items/:cartItemId')
  @ApiOperation({ summary: 'Set an authenticated customer cart item quantity' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiBadRequestResponse({ description: 'Quantity must be between 1 and 20.' })
  @ApiConflictResponse({ description: 'Food or restaurant is unavailable.' })
  @ApiNotFoundResponse({ description: 'Cart item not found.' })
  async updateItemQuantity(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('cartItemId', new ParseUUIDPipe()) cartItemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.updateItemQuantity(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      cartItemId,
      dto,
    );
  }

  @Delete('items/:cartItemId')
  @ApiOperation({
    summary: 'Remove one item from the authenticated customer cart',
  })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiNotFoundResponse({ description: 'Cart item not found.' })
  async removeItem(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('cartItemId', new ParseUUIDPipe()) cartItemId: string,
  ): Promise<CartResponseDto> {
    return this.cartService.removeItem(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      cartItemId,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the authenticated customer cart' })
  @ApiOkResponse({ type: CartResponseDto })
  async clearCart(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<CartResponseDto> {
    return this.cartService.clearCart(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
    );
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh cart prices and availability from current records',
  })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiInternalServerErrorResponse({
    description: 'Cart refresh failed safely.',
  })
  async refreshCartPricing(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<CartResponseDto> {
    return this.cartService.refreshCartPricing(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
    );
  }
}
