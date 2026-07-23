import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateCurrentUserProfileDto } from './dto/update-profile.dto';
import { User, UserRole } from './entities/user.entity';
import {
  ProfilePhotoStorageService,
  UploadedProfilePhoto,
} from './profile-photo-storage.service';
import { UsersRepository } from './users.repository';

export interface FirebaseIdentityInput {
  firebaseUid: string;
  phone: string;
  name: string | null;
  email: string | null;
  profileImage: string | null;
  emailVerified: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly profilePhotoStorage: ProfilePhotoStorageService,
  ) {}

  async findActiveByFirebaseUid(firebaseUid: string): Promise<User> {
    const user = await this.usersRepository.findByFirebaseUid(firebaseUid);

    if (!user) {
      throw new UnauthorizedException(
        'No backend user is linked to this Firebase identity.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('This user account is inactive.');
    }

    return user;
  }

  async findOrCreateByFirebaseIdentity(
    identity: FirebaseIdentityInput,
  ): Promise<User> {
    try {
      return await this.synchronizeFirebaseIdentity(identity);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          'A user already exists for this Firebase identity or phone number.',
        );
      }

      throw new InternalServerErrorException(
        'Unable to complete user sign-in.',
      );
    }
  }

  async updateCurrentProfile(
    user: User,
    dto: UpdateCurrentUserProfileDto,
    authenticatedPhone?: string,
  ): Promise<User> {
    const fullName = this.resolveAliasedValue(
      dto.fullName,
      dto.name,
      'fullName',
    );
    if (fullName !== undefined) {
      user.name = fullName.trim();
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      await this.ensureEmailIsAvailable(email, user);
      user.email = email;
      user.emailVerified = false;
    }

    const requestedPhone = this.resolveAliasedValue(
      dto.phoneNumber,
      dto.phone,
      'phoneNumber',
    );
    if (requestedPhone !== undefined) {
      const phone = this.normalizePhone(requestedPhone);
      if (
        authenticatedPhone &&
        phone !== this.normalizePhone(authenticatedPhone)
      ) {
        throw new BadRequestException(
          'Phone number changes must be completed through Firebase OTP verification.',
        );
      }
      await this.ensurePhoneIsAvailable(phone, user);
      if (user.phone !== phone) {
        user.phone = phone;
        user.phoneVerified = false;
      }
    }

    if (dto.dateOfBirth !== undefined) {
      user.dateOfBirth = this.normalizeDateOfBirth(dto.dateOfBirth);
    }

    if (dto.gender !== undefined) {
      user.gender = dto.gender;
    }

    return this.usersRepository.save(user);
  }

  async updateCurrentProfilePhoto(
    user: User,
    file: UploadedProfilePhoto,
  ): Promise<User> {
    const previousProfileImage = user.profileImage;
    const profileImage = await this.profilePhotoStorage.saveProfilePhoto(file);
    user.profileImage = profileImage;
    let updatedUser: User;
    try {
      updatedUser = await this.usersRepository.save(user);
    } catch (error) {
      await this.deleteStoredProfilePhotoSafely(profileImage);
      throw error;
    }
    await this.deleteStoredProfilePhotoSafely(previousProfileImage);
    return updatedUser;
  }

  async removeCurrentProfilePhoto(user: User): Promise<User> {
    const previousProfileImage = user.profileImage;
    if (previousProfileImage) {
      user.profileImage = null;
      user = await this.usersRepository.save(user);
      await this.deleteStoredProfilePhotoSafely(previousProfileImage);
    }

    return user;
  }

  private async synchronizeFirebaseIdentity(
    identity: FirebaseIdentityInput,
  ): Promise<User> {
    const firebaseUid = identity.firebaseUid.trim();
    const phone = this.normalizePhone(identity.phone);

    if (!firebaseUid) {
      throw new ConflictException('The Firebase identity is invalid.');
    }

    let user = await this.usersRepository.findByFirebaseUid(firebaseUid);

    if (user) {
      await this.ensurePhoneIsAvailable(phone, user);
      if (user.phone !== phone) {
        user.phone = phone;
      }
    } else {
      const phoneUser = await this.usersRepository.findByPhone(phone);

      if (phoneUser) {
        if (phoneUser.firebaseUid && phoneUser.firebaseUid !== firebaseUid) {
          throw new ConflictException(
            'This phone number is already linked to another Firebase identity.',
          );
        }
        phoneUser.firebaseUid = firebaseUid;
        user = phoneUser;
      } else {
        user = this.usersRepository.create({
          firebaseUid,
          phone,
          name: null,
          email: null,
          profileImage: null,
          dateOfBirth: null,
          gender: null,
          role: UserRole.CUSTOMER,
          isActive: true,
          phoneVerified: true,
          emailVerified: false,
          lastLoginAt: null,
        });
      }
    }

    if (!user.isActive) {
      throw new ForbiddenException('This user account is inactive.');
    }

    await this.applyFirebaseProfile(user, identity);
    user.phoneVerified = true;
    user.lastLoginAt = new Date();

    return this.usersRepository.save(user);
  }

  private normalizePhone(phone: string): string {
    const normalized = phone.trim().replace(/[\s()-]/g, '');

    if (!/^\+\d{6,15}$/.test(normalized)) {
      throw new ConflictException('The Firebase phone number is invalid.');
    }

    return normalized;
  }

  private async ensurePhoneIsAvailable(phone: string, user: User) {
    if (user.phone === phone) {
      return;
    }

    const phoneUser = await this.usersRepository.findByPhone(phone);
    if (phoneUser && phoneUser.id !== user.id) {
      throw new ConflictException(
        'This phone number is already linked to another user.',
      );
    }
  }

  private async ensureEmailIsAvailable(email: string, user: User) {
    if (!email || user.email === email) {
      return;
    }

    const emailUser = await this.usersRepository.findByEmail(email);
    if (emailUser && emailUser.id !== user.id) {
      throw new ConflictException(
        'This email address is already linked to another user.',
      );
    }
  }

  private async deleteStoredProfilePhotoSafely(
    profileImage: string | null,
  ): Promise<void> {
    try {
      await this.profilePhotoStorage.deleteProfilePhoto(profileImage);
    } catch {
      // Deleting an old local profile photo is best-effort; do not expose
      // private filesystem details or fail an already-saved profile update.
    }
  }

  private async applyFirebaseProfile(
    user: User,
    identity: FirebaseIdentityInput,
  ): Promise<void> {
    if (!user.name && identity.name) {
      user.name = identity.name;
    }

    if (!user.profileImage && identity.profileImage) {
      user.profileImage = identity.profileImage;
    }

    if (!user.email && identity.email) {
      const email = identity.email.trim().toLowerCase();
      const emailUser = await this.usersRepository.findByEmail(email);
      if (!emailUser || emailUser.id === user.id) {
        user.email = email;
        user.emailVerified = identity.emailVerified;
      }
    }
  }

  private resolveAliasedValue(
    primary: string | undefined,
    alias: string | undefined,
    fieldName: string,
  ): string | undefined {
    if (
      primary !== undefined &&
      alias !== undefined &&
      primary.trim() !== alias.trim()
    ) {
      throw new BadRequestException(`Provide only one value for ${fieldName}.`);
    }
    return primary ?? alias;
  }

  private normalizeDateOfBirth(value: string): string {
    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException('dateOfBirth must be a valid ISO date.');
    }
    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== normalized ||
      parsed > today
    ) {
      throw new BadRequestException(
        'dateOfBirth must be a valid ISO date that is not in the future.',
      );
    }
    return normalized;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
