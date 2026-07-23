import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { JwtTokenService } from './jwt-token.service';

/**
 * Shared Firebase identity boundary.
 *
 * Feature modules can use the Firebase guard without importing the full
 * AuthModule, which keeps authentication independent from UsersModule and
 * prevents a circular module dependency.
 */
@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [FirebaseAdminService, JwtTokenService, FirebaseAuthGuard],
  exports: [FirebaseAdminService, JwtTokenService, FirebaseAuthGuard],
})
export class FirebaseAuthModule {}
