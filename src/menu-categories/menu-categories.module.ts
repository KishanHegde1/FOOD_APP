import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { UsersModule } from '../users/users.module';
import { MenuCategoriesController } from './menu-categories.controller';
import { MenuCategoriesRepository } from './menu-categories.repository';
import { MenuCategoriesService } from './menu-categories.service';
import { MenuCategory } from './entities/menu-category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuCategory]),
    AuthModule,
    RestaurantsModule,
    UsersModule,
  ],
  controllers: [MenuCategoriesController],
  providers: [MenuCategoriesRepository, MenuCategoriesService],
  exports: [MenuCategoriesRepository, MenuCategoriesService],
})
export class MenuCategoriesModule {}
