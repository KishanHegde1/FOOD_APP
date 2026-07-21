import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { FirebaseAdminService } from './firebase-admin.service';

describe('FirebaseAdminService credential loading', () => {
  const serviceAccountJson = JSON.stringify({
    project_id: 'food-app',
    client_email: 'firebase-adminsdk@example.iam.gserviceaccount.com',
    private_key:
      '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
  });

  it('loads Firebase credentials from JSON environment variable first', () => {
    const service = firebaseService({
      FIREBASE_SERVICE_ACCOUNT_JSON: serviceAccountJson,
      FIREBASE_SERVICE_ACCOUNT_PATH: './missing.json',
    });

    expect(service.loadServiceAccount()).toMatchObject({
      projectId: 'food-app',
      clientEmail: 'firebase-adminsdk@example.iam.gserviceaccount.com',
      privateKey:
        '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    });
  });

  it('loads Firebase credentials from a local file path', async () => {
    const directory = join('secrets', `firebase-test-${Date.now()}`);
    const filePath = join(directory, 'firebase-service-account.json');
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, serviceAccountJson);

    try {
      const service = firebaseService({
        FIREBASE_SERVICE_ACCOUNT_PATH: filePath,
      });

      expect(service.loadServiceAccount()).toMatchObject({
        projectId: 'food-app',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('supports the Render secret-file path shape', () => {
    const service = firebaseService({});

    expect(
      service.resolveServiceAccountPath(
        '/etc/secrets/firebase-service-account.json',
      ),
    ).toContain('firebase-service-account.json');
  });

  it('fails clearly when the Firebase file is missing', () => {
    const service = firebaseService({
      FIREBASE_SERVICE_ACCOUNT_PATH: './secrets/missing.json',
    });

    expect(() => service.loadServiceAccount()).toThrow(
      'The Firebase service-account file could not be found.',
    );
  });

  it('fails clearly for malformed Firebase JSON', () => {
    const service = firebaseService({
      FIREBASE_SERVICE_ACCOUNT_JSON: '{not-json',
    });

    expect(() => service.loadServiceAccount()).toThrow(
      'Firebase service-account credentials are invalid JSON.',
    );
  });

  it('validates required Firebase service-account fields', () => {
    const service = firebaseService({
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: 'food-app',
      }),
    });

    expect(() => service.loadServiceAccount()).toThrow(
      'Firebase service-account credentials must include project_id, client_email, and private_key.',
    );
  });
});

function firebaseService(values: Record<string, string>): FirebaseAdminService {
  return new FirebaseAdminService({
    get: <T = string>(key: string): T | undefined => values[key] as T,
  } as unknown as ConfigService);
}
