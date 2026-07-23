import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAuthModule } from './firebase-auth.module';

@Module({
  imports: [FirebaseAuthModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [FirebaseAuthModule],
})
export class AuthModule {}
