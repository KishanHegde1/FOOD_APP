import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Food } from '../foods/entities/food.entity';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartItemResponseDto } from './dto/cart-item-response.dto';
import {
  CartResponseDto,
  CartRestaurantResponseDto,
} from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartRepository } from './cart.repository';
import { CartItem } from './entities/cart-item.entity';
import { Cart } from './entities/cart.entity';

const MAX_CART_ITEM_QUANTITY = 20;

@Injectable()
export class CartService {
  constructor(private readonly cartRepository: CartRepository) {}

  async getCurrentCart(user: User): Promise<CartResponseDto> {
    return this.safely(async () => {
      this.ensureCustomer(user);
      const cart = await this.cartRepository.findCartWithItemsByUserId(user.id);
      if (!cart) {
        return this.emptyCart();
      }

      await this.cartRepository.updateCartItemPrices(cart.items ?? []);
      return this.toResponse(cart);
    });
  }

  async refreshCartPricing(user: User): Promise<CartResponseDto> {
    return this.getCurrentCart(user);
  }

  async addItem(user: User, dto: AddCartItemDto): Promise<CartResponseDto> {
    return this.safely(async () => {
      this.ensureCustomer(user);

      await this.cartRepository.transaction(async (manager) => {
        const food = await this.cartRepository.findFoodByIdWithRestaurant(
          dto.foodItemId,
          manager,
        );
        if (!food) {
          throw new NotFoundException('Food item not found.');
        }
        this.ensureFoodCanBeAdded(food);

        let cart = await this.cartRepository.findCartWithItemsByUserId(
          user.id,
          manager,
          true,
        );
        if (!cart) {
          cart = this.cartRepository.createCart(
            {
              userId: user.id,
              restaurantId: food.restaurantId,
              couponCode: null,
            },
            manager,
          );
          cart = await this.cartRepository.saveCart(cart, manager);
        } else if (
          cart.restaurantId &&
          cart.restaurantId !== food.restaurantId
        ) {
          if (!dto.replaceCart) {
            throw this.restaurantConflict(cart, food.restaurant);
          }
          await this.cartRepository.deleteAllCartItems(cart.id, manager);
          cart.restaurantId = food.restaurantId;
          cart.restaurant = food.restaurant;
          cart.couponCode = null;
          await this.cartRepository.saveCart(cart, manager);
        } else if (!cart.restaurantId) {
          cart.restaurantId = food.restaurantId;
          cart.restaurant = food.restaurant;
          await this.cartRepository.saveCart(cart, manager);
        }

        const existingItem = await this.cartRepository.findCartItemByFoodId(
          cart.id,
          food.id,
          manager,
        );
        if (existingItem) {
          const quantity = existingItem.quantity + dto.quantity;
          this.ensureQuantity(quantity);
          existingItem.quantity = quantity;
          existingItem.unitPricePaise = food.pricePaise;
          await this.cartRepository.saveCartItem(existingItem, manager);
          return;
        }

        await this.cartRepository.saveCartItem(
          this.cartRepository.createCartItem(
            {
              cartId: cart.id,
              foodItemId: food.id,
              quantity: dto.quantity,
              unitPricePaise: food.pricePaise,
              instructions: null,
            },
            manager,
          ),
          manager,
        );
      });

      return this.getCurrentCart(user);
    });
  }

  async updateItemQuantity(
    user: User,
    cartItemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.safely(async () => {
      this.ensureCustomer(user);
      this.ensureQuantity(dto.quantity);

      await this.cartRepository.transaction(async (manager) => {
        const item = await this.cartRepository.findCartItemByIdForUser(
          cartItemId,
          user.id,
          manager,
        );
        if (!item) {
          throw new NotFoundException('Cart item not found.');
        }
        this.ensureFoodCanBeAdded(item.food);
        item.quantity = dto.quantity;
        item.unitPricePaise = item.food.pricePaise;
        await this.cartRepository.saveCartItem(item, manager);
      });

      return this.getCurrentCart(user);
    });
  }

  async removeItem(user: User, cartItemId: string): Promise<CartResponseDto> {
    return this.safely(async () => {
      this.ensureCustomer(user);

      await this.cartRepository.transaction(async (manager) => {
        const item = await this.cartRepository.findCartItemByIdForUser(
          cartItemId,
          user.id,
          manager,
        );
        if (!item) {
          throw new NotFoundException('Cart item not found.');
        }

        await this.cartRepository.deleteCartItem(item.id, manager);
        const remainingItems = await this.cartRepository.countCartItems(
          item.cartId,
          manager,
        );
        if (remainingItems === 0) {
          item.cart.restaurantId = null;
          item.cart.restaurant = null;
          item.cart.couponCode = null;
          await this.cartRepository.saveCart(item.cart, manager);
        }
      });

      return this.getCurrentCart(user);
    });
  }

  async clearCart(user: User): Promise<CartResponseDto> {
    return this.safely(async () => {
      this.ensureCustomer(user);

      await this.cartRepository.transaction(async (manager) => {
        const cart = await this.cartRepository.findCartWithItemsByUserId(
          user.id,
          manager,
          true,
        );
        if (!cart) {
          return;
        }

        await this.cartRepository.deleteAllCartItems(cart.id, manager);
        cart.restaurantId = null;
        cart.restaurant = null;
        cart.couponCode = null;
        await this.cartRepository.saveCart(cart, manager);
      });

      return this.getCurrentCart(user);
    });
  }

  private ensureCustomer(user: User): void {
    if (!user.isActive) {
      throw new ForbiddenException('This user account is inactive.');
    }
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only customers can manage a customer cart.',
      );
    }
  }

  private ensureFoodCanBeAdded(food: Food): void {
    if (!food.isActive) {
      throw new ConflictException('This food item is inactive.');
    }
    if (!food.isAvailable) {
      throw new ConflictException('This food item is unavailable.');
    }
    const restaurant = food.restaurant;
    if (
      !restaurant.isActive ||
      restaurant.status !== RestaurantStatus.APPROVED
    ) {
      throw new ConflictException('This restaurant is unavailable.');
    }
    if (!restaurant.isOpen) {
      throw new ConflictException('This restaurant is currently closed.');
    }
  }

  private ensureQuantity(quantity: number): void {
    if (quantity < 1 || quantity > MAX_CART_ITEM_QUANTITY) {
      throw new BadRequestException(
        `Cart item quantity must be between 1 and ${MAX_CART_ITEM_QUANTITY}.`,
      );
    }
  }

  private restaurantConflict(
    cart: Cart,
    requestedRestaurant: Restaurant,
  ): ConflictException {
    return new ConflictException({
      code: 'CART_RESTAURANT_CONFLICT',
      message: 'Your cart contains items from another restaurant.',
      currentRestaurant: cart.restaurant
        ? { id: cart.restaurant.id, name: cart.restaurant.name }
        : null,
      requestedRestaurant: {
        id: requestedRestaurant.id,
        name: requestedRestaurant.name,
      },
    });
  }

  private emptyCart(): CartResponseDto {
    return {
      id: null,
      restaurant: null,
      items: [],
      totalItems: 0,
      subtotalPaise: 0,
      hasUnavailableItems: false,
    };
  }

  private toResponse(cart: Cart): CartResponseDto {
    const items = (cart.items ?? []).map((item) => this.toCartItem(item));
    const restaurant = cart.restaurant
      ? this.toRestaurant(cart.restaurant)
      : null;

    return {
      id: cart.id,
      restaurant,
      items,
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      subtotalPaise: items.reduce(
        (total, item) => total + item.itemSubtotalPaise,
        0,
      ),
      hasUnavailableItems: items.some((item) => !item.isAvailable),
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  private toCartItem(item: CartItem): CartItemResponseDto {
    const food = item.food;
    const isAvailable = this.isFoodCurrentlyAvailable(food);
    const unitPricePaise = food.pricePaise;
    return {
      id: item.id,
      foodItemId: food.id,
      name: food.name,
      description: food.description,
      imageUrl: food.imageUrl,
      isVeg: food.isVeg,
      isAvailable,
      quantity: item.quantity,
      unitPricePaise,
      originalPricePaise: food.originalPricePaise,
      itemSubtotalPaise: unitPricePaise * item.quantity,
    };
  }

  private isFoodCurrentlyAvailable(food: Food): boolean {
    return (
      food.isActive &&
      food.isAvailable &&
      food.restaurant.isActive &&
      food.restaurant.status === RestaurantStatus.APPROVED
    );
  }

  private toRestaurant(restaurant: Restaurant): CartRestaurantResponseDto {
    return {
      id: restaurant.id,
      name: restaurant.name,
      imageUrl: restaurant.logoUrl,
      isOpen: restaurant.isOpen,
    };
  }

  private async safely<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          'The cart changed concurrently. Please retry.',
        );
      }
      throw new InternalServerErrorException('Unable to update the cart.');
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
