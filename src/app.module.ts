import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import databaseConfig from './config/database.config';
import { DineInModule } from './dine-in/dine-in.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { FoodsModule } from './foods/foods.module';
import { MenuCategoriesModule } from './menu-categories/menu-categories.module';
import { PaymentsModule } from './payments/payments.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = configService.get<string>('database.url');
        const sslEnabled = configService.get<boolean>('database.ssl') === true;
        const ssl = sslEnabled
          ? {
              rejectUnauthorized:
                configService.get<boolean>('database.sslRejectUnauthorized') ===
                true,
            }
          : false;

        return {
          type: 'postgres',
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: configService.getOrThrow<string>('database.host'),
                port: configService.getOrThrow<number>('database.port'),
                username: configService.getOrThrow<string>('database.username'),
                password: configService.get<string>('database.password') ?? '',
                database: configService.getOrThrow<string>('database.database'),
              }),
          ssl,
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
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
