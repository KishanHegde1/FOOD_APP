import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, EntityManager, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { DineInSessionMember } from './entities/dine-in-session-member.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import {
  ACTIVE_DINE_IN_SESSION_STATUSES,
  DineInSessionStatus,
} from './enums/dine-in-session-status.enum';

@Injectable()
export class DineInSessionsRepository {
  constructor(
    @InjectRepository(DineInSession)
    private readonly sessions: Repository<DineInSession>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findActiveByTable(
    restaurantTableId: string,
    manager?: EntityManager,
  ): Promise<DineInSession | null> {
    return (
      (await this.repository(manager)
        .createQueryBuilder('session')
        .where('session.restaurant_table_id = :restaurantTableId', {
          restaurantTableId,
        })
        .andWhere('session.status IN (:...statuses)', {
          statuses: ACTIVE_DINE_IN_SESSION_STATUSES,
        })
        .orderBy('session.started_at', 'DESC')
        .getOne()) ?? null
    );
  }

  async findCurrentForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<DineInSession | null> {
    return (
      (await this.repository(manager)
        .createQueryBuilder('session')
        .innerJoin(
          DineInSessionMember,
          'member',
          'member.dine_in_session_id = session.id',
        )
        .where('member.user_id = :userId', { userId })
        .andWhere('member.is_active = :memberIsActive', {
          memberIsActive: true,
        })
        .andWhere('session.status IN (:...statuses)', {
          statuses: ACTIVE_DINE_IN_SESSION_STATUSES,
        })
        .orderBy('session.started_at', 'DESC')
        .getOne()) ?? null
    );
  }

  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<DineInSession | null> {
    return (await this.repository(manager).findOne({ where: { id } })) ?? null;
  }

  async findByIdForMember(
    id: string,
    userId: string,
  ): Promise<DineInSession | null> {
    return (
      (await this.sessions
        .createQueryBuilder('session')
        .innerJoin(
          DineInSessionMember,
          'member',
          'member.dine_in_session_id = session.id',
        )
        .where('session.id = :id', { id })
        .andWhere('member.user_id = :userId', { userId })
        .andWhere('member.is_active = :memberIsActive', {
          memberIsActive: true,
        })
        .getOne()) ?? null
    );
  }

  async lockUserById(id: string, manager: EntityManager): Promise<User | null> {
    return (
      (await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .where('user.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
  }

  create(
    data: DeepPartial<DineInSession>,
    manager?: EntityManager,
  ): DineInSession {
    return this.repository(manager).create(data);
  }

  async save(
    session: DineInSession,
    manager?: EntityManager,
  ): Promise<DineInSession> {
    return this.repository(manager).save(session);
  }

  async incrementRound(id: string, manager?: EntityManager): Promise<void> {
    await this.repository(manager)
      .createQueryBuilder()
      .update(DineInSession)
      .set({ currentRoundNumber: () => 'current_round_number + 1' })
      .where('id = :id', { id })
      .execute();
  }

  async markBillRequested(id: string): Promise<void> {
    await this.updateStatus(id, DineInSessionStatus.BILL_REQUESTED, {
      billRequestedAt: new Date(),
    });
  }

  async markPaymentPending(id: string): Promise<void> {
    await this.updateStatus(id, DineInSessionStatus.PAYMENT_PENDING);
  }

  async markPaid(id: string): Promise<void> {
    await this.updateStatus(id, DineInSessionStatus.PAID, {
      paymentCompletedAt: new Date(),
    });
  }

  async markCompleted(id: string): Promise<void> {
    const now = new Date();
    await this.updateStatus(id, DineInSessionStatus.COMPLETED, {
      completedAt: now,
      closedAt: now,
    });
  }

  async markCancelled(
    id: string,
    cancellationReason: string | null,
  ): Promise<void> {
    const now = new Date();
    await this.updateStatus(id, DineInSessionStatus.CANCELLED, {
      cancelledAt: now,
      closedAt: now,
      cancellationReason,
    });
  }

  async transaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(operation);
  }

  private async updateStatus(
    id: string,
    status: DineInSessionStatus,
    data: Partial<DineInSession> = {},
  ): Promise<void> {
    await this.sessions.update(id, { ...data, status });
  }

  private repository(manager?: EntityManager): Repository<DineInSession> {
    return manager ? manager.getRepository(DineInSession) : this.sessions;
  }
}
