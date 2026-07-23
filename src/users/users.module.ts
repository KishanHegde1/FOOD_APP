import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseAuthModule } from '../auth/firebase-auth.module';
import { User } from './entities/user.entity';
import { ProfilePhotoStorageService } from './profile-photo-storage.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), FirebaseAuthModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService, ProfilePhotoStorageService],
  exports: [UsersService],
})
export class UsersModule {}
