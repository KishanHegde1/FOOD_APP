import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';

export interface UploadedProfilePhoto {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size: number;
}

export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_PHOTO_UPLOAD_ROUTE = '/uploads/profile-photos';

const MIME_EXTENSION_MAP = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

type StorageDriver = 'local' | 'cloudinary';

interface ProfilePhotoObjectStorage {
  save(file: UploadedProfilePhoto, extension: string): Promise<string>;
  delete(profileImage: string | null): Promise<void>;
}

@Injectable()
export class ProfilePhotoStorageService {
  private readonly logger = new Logger(ProfilePhotoStorageService.name);
  private readonly uploadDir = join(process.cwd(), 'uploads', 'profile-photos');
  private readonly provider: ProfilePhotoObjectStorage;

  constructor(private readonly configService?: ConfigService) {
    const driver = this.storageDriver();
    this.provider =
      driver === 'cloudinary'
        ? new CloudinaryProfilePhotoStorageProvider()
        : new LocalProfilePhotoStorageProvider(this.uploadDir);

    if (process.env.NODE_ENV === 'production' && driver === 'local') {
      this.logger.warn(
        'STORAGE_DRIVER=local is not persistent on Render free instances. Use object storage for production profile photos.',
      );
    }
  }

  async saveProfilePhoto(file: UploadedProfilePhoto): Promise<string> {
    this.validate(file);

    const extension = MIME_EXTENSION_MAP.get(file.mimetype) ?? '.jpg';
    return this.provider.save(file, extension);
  }

  async deleteProfilePhoto(profileImage: string | null): Promise<void> {
    await this.provider.delete(profileImage);
  }

  private validate(file: UploadedProfilePhoto): void {
    if (!file?.buffer || file.size <= 0) {
      throw new BadRequestException('A profile photo file is required.');
    }

    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      throw new BadRequestException('Profile photo must not exceed 2 MB.');
    }

    if (!MIME_EXTENSION_MAP.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPG, PNG, and WEBP profile photos are supported.',
      );
    }

    const originalExtension = extname(file.originalname ?? '').toLowerCase();
    if (
      originalExtension &&
      !['.jpg', '.jpeg', '.png', '.webp'].includes(originalExtension)
    ) {
      throw new BadRequestException(
        'Only JPG, PNG, and WEBP profile photos are supported.',
      );
    }
  }

  private storageDriver(): StorageDriver {
    const driver =
      this.configService?.get<string>('STORAGE_DRIVER') ??
      process.env.STORAGE_DRIVER ??
      'local';
    return driver.trim().toLowerCase() === 'cloudinary'
      ? 'cloudinary'
      : 'local';
  }
}

class LocalProfilePhotoStorageProvider implements ProfilePhotoObjectStorage {
  constructor(private readonly uploadDir: string) {}

  async save(file: UploadedProfilePhoto, extension: string): Promise<string> {
    await mkdir(this.uploadDir, { recursive: true });
    const fileName = `${randomUUID()}${extension}`;
    const filePath = join(this.uploadDir, fileName);

    await writeFile(filePath, file.buffer, { flag: 'wx' });
    return `${PROFILE_PHOTO_UPLOAD_ROUTE}/${fileName}`;
  }

  async delete(profileImage: string | null): Promise<void> {
    const fileName = this.localProfilePhotoFileName(profileImage);
    if (!fileName) return;

    try {
      await unlink(join(this.uploadDir, fileName));
    } catch (error) {
      if (!this.isMissingFileError(error)) {
        throw error;
      }
    }
  }

  private localProfilePhotoFileName(
    profileImage: string | null,
  ): string | null {
    if (!profileImage) return null;

    const prefix = `${PROFILE_PHOTO_UPLOAD_ROUTE}/`;
    if (!profileImage.startsWith(prefix)) return null;

    const fileName = profileImage.slice(prefix.length);
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(fileName)) return null;

    return fileName;
  }

  private isMissingFileError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    );
  }
}

class CloudinaryProfilePhotoStorageProvider implements ProfilePhotoObjectStorage {
  save(): Promise<string> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Cloudinary profile-photo storage is not configured yet. Set STORAGE_DRIVER=local or add a Cloudinary implementation.',
      ),
    );
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }
}
