import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { FirebaseLoginResponseDto } from './dto/firebase-login-response.dto';
import { FirebaseUser } from './interfaces/firebase-user.interface';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async loginWithFirebase(
    firebaseUser: FirebaseUser,
  ): Promise<FirebaseLoginResponseDto> {
    const user = await this.usersService.findOrCreateByFirebaseIdentity({
      firebaseUid: firebaseUser.uid,
      phone: firebaseUser.phoneNumber,
      name: firebaseUser.name,
      email: firebaseUser.email,
      profileImage: firebaseUser.picture,
      emailVerified: firebaseUser.emailVerified,
    });

    return { user: this.toSafeUserProfile(user) };
  }

  private toSafeUserProfile(user: User): FirebaseLoginResponseDto['user'] {
    return {
      id: user.id,
      firebaseUid: user.firebaseUid ?? '',
      phone: user.phone ?? '',
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      role: user.role,
      phoneVerified: user.phoneVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }
}
