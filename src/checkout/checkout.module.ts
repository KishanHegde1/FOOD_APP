import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { UsersModule } from '../users/users.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutRepository } from './checkout.repository';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [CartModule, AddressesModule, AuthModule, UsersModule],
  controllers: [CheckoutController],
  providers: [CheckoutRepository, CheckoutService],
})
export class CheckoutModule {}
