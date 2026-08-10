import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Food } from '../foods/entities/food.entity';
import { DineInOrdersRepository } from './dine-in-orders.repository';
import { DineInSession } from './entities/dine-in-session.entity';
import { KitchenTicket } from './entities/kitchen-ticket.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';

describe('DineInOrdersRepository', () => {
  it('locks only the order alias when loading nullable joined relations', async () => {
    const order = { id: '50000000-0000-4000-8000-000000000001' } as Order;
    const leftJoinAndSelect = jest.fn();
    const setLock = jest.fn();
    const queryBuilder = {
      leftJoinAndSelect,
      where: jest.fn().mockReturnThis(),
      setLock,
      getOne: jest.fn().mockResolvedValue(order),
    } as unknown as jest.Mocked<SelectQueryBuilder<Order>>;
    leftJoinAndSelect.mockReturnValue(queryBuilder);
    setLock.mockReturnValue(queryBuilder);
    const createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
    const orderRepository = {
      createQueryBuilder,
    } as unknown as Repository<Order>;
    const manager = {
      getRepository: jest.fn().mockReturnValue(orderRepository),
    } as unknown as EntityManager;
    const repository = new DineInOrdersRepository(
      {} as Repository<Order>,
      {} as Repository<OrderItem>,
      {} as Repository<OrderStatusHistory>,
      {} as Repository<KitchenTicket>,
      {} as Repository<Food>,
      {} as Repository<DineInSession>,
      {} as DataSource,
    );

    await expect(repository.lockOrder(order.id, manager)).resolves.toBe(order);
    expect(createQueryBuilder).toHaveBeenCalledWith('locked_order');
    expect(leftJoinAndSelect).toHaveBeenCalledTimes(3);
    expect(setLock).toHaveBeenCalledWith('pessimistic_write', undefined, [
      'locked_order',
    ]);
  });
});
