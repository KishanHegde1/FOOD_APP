import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';

/**
 * Shared Firebase identity boundary.
 *
 * Feature modules can use the Firebase guard without importing the full
 * AuthModule, which keeps authentication independent from UsersModule and
 * prevents a circular module dependency.
 */
@Module({
  imports: [ConfigModule],
  providers: [FirebaseAdminService, FirebaseAuthGuard],
  exports: [FirebaseAdminService, FirebaseAuthGuard],
})
export class FirebaseAuthModule {}
