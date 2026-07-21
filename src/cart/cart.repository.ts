import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, EntityManager, Repository } from 'typeorm';
import { Food } from '../foods/entities/food.entity';
import { CartItem } from './entities/cart-item.entity';
import { Cart } from './entities/cart.entity';

@Injectable()
export class CartRepository {
  constructor(
    @InjectRepository(Cart)
    private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItems: Repository<CartItem>,
    @InjectRepository(Food)
    private readonly foods: Repository<Food>,
    private readonly dataSource: DataSource,
  ) {}

  async findCartWithItemsByUserId(
    userId: string,
    manager?: EntityManager,
    lock = false,
  ): Promise<Cart | null> {
    const builder = this.cartRepository(manager)
      .createQueryBuilder('cart')
      .leftJoinAndSelect('cart.restaurant', 'cartRestaurant')
      .leftJoinAndSelect('cart.items', 'cartItem')
      .leftJoinAndSelect('cartItem.food', 'food')
      .leftJoinAndSelect('food.restaurant', 'foodRestaurant')
      .where('cart.user_id = :userId', { userId })
      .orderBy('cartItem.created_at', 'ASC');

    if (lock) {
      builder.setLock('pessimistic_write', undefined, ['cart']);
    }

    return (await builder.getOne()) ?? null;
  }

  async findCartItemByIdForUser(
    cartItemId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<CartItem | null> {
    return (
      (await this.cartItemRepository(manager)
        .createQueryBuilder('cartItem')
        .innerJoinAndSelect('cartItem.cart', 'cart')
        .leftJoinAndSelect('cart.restaurant', 'cartRestaurant')
        .leftJoinAndSelect('cartItem.food', 'food')
        .leftJoinAndSelect('food.restaurant', 'foodRestaurant')
        .where('cartItem.id = :cartItemId', { cartItemId })
        .andWhere('cart.user_id = :userId', { userId })
        .getOne()) ?? null
    );
  }

  async findCartItemByFoodId(
    cartId: string,
    foodItemId: string,
    manager?: EntityManager,
  ): Promise<CartItem | null> {
    return (
      (await this.cartItemRepository(manager).findOne({
        where: { cartId, foodItemId },
      })) ?? null
    );
  }

  async findFoodByIdWithRestaurant(
    foodItemId: string,
    manager?: EntityManager,
  ): Promise<Food | null> {
    return (
      (await this.foodRepository(manager).findOne({
        where: { id: foodItemId },
        relations: { restaurant: true },
      })) ?? null
    );
  }

  createCart(data: DeepPartial<Cart>, manager?: EntityManager): Cart {
    return this.cartRepository(manager).create(data);
  }

  async saveCart(cart: Cart, manager?: EntityManager): Promise<Cart> {
    return this.cartRepository(manager).save(cart);
  }

  createCartItem(
    data: DeepPartial<CartItem>,
    manager?: EntityManager,
  ): CartItem {
    return this.cartItemRepository(manager).create(data);
  }

  async saveCartItem(
    item: CartItem,
    manager?: EntityManager,
  ): Promise<CartItem> {
    return this.cartItemRepository(manager).save(item);
  }

  async saveCartItems(
    items: CartItem[],
    manager?: EntityManager,
  ): Promise<CartItem[]> {
    return this.cartItemRepository(manager).save(items);
  }

  async deleteCartItem(itemId: string, manager?: EntityManager): Promise<void> {
    await this.cartItemRepository(manager).delete(itemId);
  }

  async deleteAllCartItems(
    cartId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.cartItemRepository(manager).delete({ cartId });
  }

  async countCartItems(
    cartId: string,
    manager?: EntityManager,
  ): Promise<number> {
    return this.cartItemRepository(manager).count({ where: { cartId } });
  }

  async updateCartItemPrices(items: CartItem[]): Promise<void> {
    const changedItems = items.filter(
      (item) => item.food && item.unitPricePaise !== item.food.pricePaise,
    );
    if (changedItems.length === 0) {
      return;
    }

    await this.transaction(async (manager) => {
      for (const item of changedItems) {
        item.unitPricePaise = item.food.pricePaise;
      }
      await this.saveCartItems(changedItems, manager);
    });
  }

  async transaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(operation);
  }

  private cartRepository(manager?: EntityManager): Repository<Cart> {
    return manager ? manager.getRepository(Cart) : this.carts;
  }

  private cartItemRepository(manager?: EntityManager): Repository<CartItem> {
    return manager ? manager.getRepository(CartItem) : this.cartItems;
  }

  private foodRepository(manager?: EntityManager): Repository<Food> {
    return manager ? manager.getRepository(Food) : this.foods;
  }
}
