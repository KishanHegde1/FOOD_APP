import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return (await this.repository.findOne({ where: { firebaseUid } })) ?? null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return (await this.repository.findOne({ where: { phone } })) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return (await this.repository.findOne({ where: { email } })) ?? null;
  }

  create(data: Partial<User>): User {
    return this.repository.create(data);
  }

  async save(user: User): Promise<User> {
    return this.repository.save(user);
  }
}
