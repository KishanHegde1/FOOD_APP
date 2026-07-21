import { BadRequestException } from '@nestjs/common';
import { access } from 'fs/promises';
import {
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_UPLOAD_ROUTE,
  ProfilePhotoStorageService,
} from './profile-photo-storage.service';

describe('ProfilePhotoStorageService', () => {
  let service: ProfilePhotoStorageService;

  beforeEach(() => {
    service = new ProfilePhotoStorageService();
  });

  it('stores a supported profile photo with a generated public URL', async () => {
    const profileImage = await service.saveProfilePhoto({
      buffer: Buffer.from('fake image bytes'),
      mimetype: 'image/png',
      originalname: 'my-photo.png',
      size: 16,
    });

    expect(profileImage).toMatch(
      /^\/uploads\/profile-photos\/[0-9a-f-]{36}\.png$/,
    );
    expect(profileImage).not.toContain('my-photo');

    await service.deleteProfilePhoto(profileImage);
    await expect(access(profileImage)).rejects.toThrow();
  });

  it('rejects unsupported profile photo file types', async () => {
    await expect(
      service.saveProfilePhoto({
        buffer: Buffer.from('script'),
        mimetype: 'application/x-msdownload',
        originalname: 'malware.exe',
        size: 6,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects profile photos larger than 2 MB', async () => {
    await expect(
      service.saveProfilePhoto({
        buffer: Buffer.alloc(PROFILE_PHOTO_MAX_BYTES + 1),
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
        size: PROFILE_PHOTO_MAX_BYTES + 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignores non-local photo URLs during delete', async () => {
    await expect(
      service.deleteProfilePhoto('https://example.com/photo.jpg'),
    ).resolves.toBeUndefined();
    await expect(
      service.deleteProfilePhoto(`${PROFILE_PHOTO_UPLOAD_ROUTE}/../evil.jpg`),
    ).resolves.toBeUndefined();
  });
});
