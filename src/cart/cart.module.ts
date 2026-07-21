import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Food } from '../foods/entities/food.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { CartController } from './cart.controller';
import { CartRepository } from './cart.repository';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';
import { Cart } from './entities/cart.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem, Food, Restaurant, User]),
    AuthModule,
    UsersModule,
  ],
  controllers: [CartController],
  providers: [CartRepository, CartService],
  exports: [CartRepository, CartService],
})
export class CartModule {}
