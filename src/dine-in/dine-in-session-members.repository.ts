import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { DineInMemberRole } from './enums/dine-in-member-role.enum';
import { DineInSessionMember } from './entities/dine-in-session-member.entity';

@Injectable()
export class DineInSessionMembersRepository {
  constructor(
    @InjectRepository(DineInSessionMember)
    private readonly members: Repository<DineInSessionMember>,
  ) {}

  async findMembership(
    dineInSessionId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<DineInSessionMember | null> {
    return (
      (await this.repository(manager).findOne({
        where: { dineInSessionId, userId },
      })) ?? null
    );
  }

  async findActiveMembership(
    dineInSessionId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<DineInSessionMember | null> {
    return (
      (await this.repository(manager).findOne({
        where: { dineInSessionId, userId, isActive: true },
      })) ?? null
    );
  }

  createHost(
    dineInSessionId: string,
    userId: string,
    manager?: EntityManager,
  ): DineInSessionMember {
    return this.create(
      {
        dineInSessionId,
        userId,
        memberRole: DineInMemberRole.HOST,
        isActive: true,
        joinedAt: new Date(),
        leftAt: null,
      },
      manager,
    );
  }

  createGuest(
    dineInSessionId: string,
    userId: string,
    manager?: EntityManager,
  ): DineInSessionMember {
    return this.create(
      {
        dineInSessionId,
        userId,
        memberRole: DineInMemberRole.GUEST,
        isActive: true,
        joinedAt: new Date(),
        leftAt: null,
      },
      manager,
    );
  }

  create(
    data: DeepPartial<DineInSessionMember>,
    manager?: EntityManager,
  ): DineInSessionMember {
    return this.repository(manager).create(data);
  }

  async save(
    member: DineInSessionMember,
    manager?: EntityManager,
  ): Promise<DineInSessionMember> {
    return this.repository(manager).save(member);
  }

  async reactivate(
    member: DineInSessionMember,
    manager?: EntityManager,
  ): Promise<DineInSessionMember> {
    member.isActive = true;
    member.joinedAt = new Date();
    member.leftAt = null;
    return this.save(member, manager);
  }

  async deactivate(
    member: DineInSessionMember,
    manager?: EntityManager,
  ): Promise<DineInSessionMember> {
    member.isActive = false;
    member.leftAt = new Date();
    return this.save(member, manager);
  }

  async listActiveMembers(
    dineInSessionId: string,
  ): Promise<DineInSessionMember[]> {
    return this.members.find({
      where: { dineInSessionId, isActive: true },
      order: { joinedAt: 'ASC', id: 'ASC' },
    });
  }

  private repository(manager?: EntityManager): Repository<DineInSessionMember> {
    return manager ? manager.getRepository(DineInSessionMember) : this.members;
  }
}
