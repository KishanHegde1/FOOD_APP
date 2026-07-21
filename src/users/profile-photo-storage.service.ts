import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class ProfilePhotoStorageService {
  private readonly uploadDir = join(process.cwd(), 'uploads', 'profile-photos');

  async saveProfilePhoto(file: UploadedProfilePhoto): Promise<string> {
    this.validate(file);

    await mkdir(this.uploadDir, { recursive: true });
    const extension = MIME_EXTENSION_MAP.get(file.mimetype) ?? '.jpg';
    const fileName = `${randomUUID()}${extension}`;
    const filePath = join(this.uploadDir, fileName);

    await writeFile(filePath, file.buffer, { flag: 'wx' });
    return `${PROFILE_PHOTO_UPLOAD_ROUTE}/${fileName}`;
  }

  async deleteProfilePhoto(profileImage: string | null): Promise<void> {
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
