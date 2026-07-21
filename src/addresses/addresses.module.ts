import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { AddressesController } from './addresses.controller';
import { AddressesRepository } from './addresses.repository';
import { AddressesService } from './addresses.service';
import { Address } from './entities/address.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Address, User]), AuthModule, UsersModule],
  controllers: [AddressesController],
  providers: [AddressesRepository, AddressesService],
  exports: [AddressesRepository, AddressesService],
})
export class AddressesModule {}
