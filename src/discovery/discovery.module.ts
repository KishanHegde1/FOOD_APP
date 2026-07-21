import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from '../foods/entities/food.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryRepository } from './discovery.repository';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [TypeOrmModule.forFeature([Restaurant, Food])],
  controllers: [DiscoveryController],
  providers: [DiscoveryRepository, DiscoveryService],
})
export class DiscoveryModule {}
