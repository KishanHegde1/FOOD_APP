import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { RestaurantTable } from './entities/restaurant-table.entity';

@Injectable()
export class RestaurantTablesRepository {
  constructor(
    @InjectRepository(RestaurantTable)
    private readonly tables: Repository<RestaurantTable>,
  ) {}

  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<RestaurantTable | null> {
    return (await this.repository(manager).findOne({ where: { id } })) ?? null;
  }

  async findActiveByIdAndRestaurant(
    id: string,
    restaurantId: string,
    manager?: EntityManager,
  ): Promise<RestaurantTable | null> {
    return (
      (await this.repository(manager).findOne({
        where: { id, restaurantId, isActive: true },
      })) ?? null
    );
  }

  async findByRestaurantAndTableNumber(
    restaurantId: string,
    tableNumber: string,
  ): Promise<RestaurantTable | null> {
    return (
      (await this.tables.findOne({ where: { restaurantId, tableNumber } })) ??
      null
    );
  }

  async findByQrHash(qrTokenHash: string): Promise<RestaurantTable | null> {
    return (await this.tables.findOne({ where: { qrTokenHash } })) ?? null;
  }

  async lockById(
    id: string,
    manager: EntityManager,
  ): Promise<RestaurantTable | null> {
    return (
      (await this.repository(manager)
        .createQueryBuilder('restaurantTable')
        .where('restaurantTable.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
  }

  create(
    data: DeepPartial<RestaurantTable>,
    manager?: EntityManager,
  ): RestaurantTable {
    return this.repository(manager).create(data);
  }

  async save(
    table: RestaurantTable,
    manager?: EntityManager,
  ): Promise<RestaurantTable> {
    return this.repository(manager).save(table);
  }

  async listByRestaurant(restaurantId: string): Promise<RestaurantTable[]> {
    return this.tables.find({
      where: { restaurantId },
      order: { tableNumber: 'ASC', id: 'ASC' },
    });
  }

  private repository(manager?: EntityManager): Repository<RestaurantTable> {
    return manager ? manager.getRepository(RestaurantTable) : this.tables;
  }
}
