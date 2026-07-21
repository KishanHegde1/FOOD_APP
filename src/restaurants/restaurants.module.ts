import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { Restaurant } from './entities/restaurant.entity';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsRepository } from './restaurants.repository';
import { RestaurantsService } from './restaurants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Restaurant]), AuthModule, UsersModule],
  controllers: [RestaurantsController],
  providers: [RestaurantsRepository, RestaurantsService],
  exports: [RestaurantsRepository, RestaurantsService],
})
export class RestaurantsModule {}
