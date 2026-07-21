import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';

@Module({
  imports: [ConfigModule, forwardRef(() => UsersModule)],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAdminService, FirebaseAuthGuard],
  exports: [FirebaseAdminService, FirebaseAuthGuard],
})
export class AuthModule {}
