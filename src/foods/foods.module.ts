import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MenuCategoriesModule } from '../menu-categories/menu-categories.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { UsersModule } from '../users/users.module';
import { Food } from './entities/food.entity';
import { FoodsController } from './foods.controller';
import { FoodsRepository } from './foods.repository';
import { FoodsService } from './foods.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Food]),
    AuthModule,
    UsersModule,
    RestaurantsModule,
    MenuCategoriesModule,
  ],
  controllers: [FoodsController],
  providers: [FoodsRepository, FoodsService],
  exports: [FoodsRepository, FoodsService],
})
export class FoodsModule {}
