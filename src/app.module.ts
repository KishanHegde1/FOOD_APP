import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { buildPostgresOptions } from './config/database-options';
import databaseConfig from './config/database.config';
import { validateEnvironment } from './config/env.utils';
import { DineInModule } from './dine-in/dine-in.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { FoodsModule } from './foods/foods.module';
import { HealthModule } from './health/health.module';
import { MenuCategoriesModule } from './menu-categories/menu-categories.module';
import { PaymentsModule } from './payments/payments.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () =>
        buildPostgresOptions(process.env, {
          autoLoadEntities: true,
        }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    RestaurantsModule,
    MenuCategoriesModule,
    FoodsModule,
    DiscoveryModule,
    CartModule,
    AddressesModule,
    CheckoutModule,
    PaymentsModule,
    DineInModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
