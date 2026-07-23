import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { FirebaseLoginResponseDto } from './dto/firebase-login-response.dto';
import { FirebaseUser } from './interfaces/firebase-user.interface';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

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

    return {
      ...(await this.jwtTokenService.issueAccessToken(user)),
      user: this.toSafeUserProfile(user),
    };
  }

  private toSafeUserProfile(user: User): FirebaseLoginResponseDto['user'] {
    return {
      id: user.id,
      phone: user.phone ?? '',
      phoneNumber: user.phone ?? '',
      fullName: user.name,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      profilePhotoUrl: user.profileImage,
      dateOfBirth: user.dateOfBirth ?? null,
      gender: user.gender ?? null,
      isProfileComplete: Boolean(
        user.name?.trim() && user.email?.trim() && user.phone?.trim(),
      ),
      role: user.role,
      phoneVerified: user.phoneVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }
}
