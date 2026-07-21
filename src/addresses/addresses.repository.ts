import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, EntityManager, Repository } from 'typeorm';
import { Address } from './entities/address.entity';

@Injectable()
export class AddressesRepository {
  constructor(
    @InjectRepository(Address)
    private readonly addresses: Repository<Address>,
    private readonly dataSource: DataSource,
  ) {}

  async findActiveByUserId(userId: string): Promise<Address[]> {
    return this.addresses.find({
      where: { userId, isActive: true },
      order: { isDefault: 'DESC', createdAt: 'DESC', id: 'ASC' },
    });
  }

  async findActiveByIdForUser(
    id: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<Address | null> {
    return (
      (await this.addressRepository(manager).findOne({
        where: { id, userId, isActive: true },
      })) ?? null
    );
  }

  async findFirstActiveByUserId(
    userId: string,
    manager?: EntityManager,
  ): Promise<Address | null> {
    return (
      (await this.addressRepository(manager).findOne({
        where: { userId, isActive: true },
        order: { createdAt: 'DESC', id: 'ASC' },
      })) ?? null
    );
  }

  create(data: DeepPartial<Address>, manager?: EntityManager): Address {
    return this.addressRepository(manager).create(data);
  }

  async save(address: Address, manager?: EntityManager): Promise<Address> {
    return this.addressRepository(manager).save(address);
  }

  async countActiveByUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<number> {
    return this.addressRepository(manager).count({
      where: { userId, isActive: true },
    });
  }

  async unsetActiveDefaultsForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.addressRepository(manager)
      .createQueryBuilder()
      .update(Address)
      .set({ isDefault: false })
      .where('user_id = :userId', { userId })
      .andWhere('is_active = :isActive', { isActive: true })
      .execute();
  }

  async transaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(operation);
  }

  private addressRepository(manager?: EntityManager): Repository<Address> {
    return manager ? manager.getRepository(Address) : this.addresses;
  }
}
