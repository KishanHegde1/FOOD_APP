import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private app!: App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.initialize();
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!idToken || typeof idToken !== 'string') {
      throw new UnauthorizedException(
        'A valid Firebase bearer token is required.',
      );
    }

    try {
      return await getAuth(this.app).verifyIdToken(idToken, true);
    } catch {
      throw new UnauthorizedException(
        'Invalid, expired, or revoked Firebase token.',
      );
    }
  }

  private initialize(): void {
    const serviceAccount = this.loadServiceAccount();

    this.app =
      getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  }

  private loadServiceAccount(): ServiceAccount {
    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    if (serviceAccountJson?.trim()) {
      return this.parseServiceAccountJson(serviceAccountJson);
    }

    const serviceAccountBase64 = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_BASE64',
    );
    if (serviceAccountBase64?.trim()) {
      return this.parseServiceAccountJson(
        Buffer.from(serviceAccountBase64.trim(), 'base64').toString('utf8'),
      );
    }

    const serviceAccountPath = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );
    if (!serviceAccountPath) {
      throw new Error(
        'Firebase Admin credentials are required. Set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_SERVICE_ACCOUNT_BASE64.',
      );
    }

    const projectRoot = resolve(process.cwd());
    const resolvedPath = resolve(projectRoot, serviceAccountPath);
    const pathFromRoot = relative(projectRoot, resolvedPath);

    if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_PATH must resolve inside the project root.',
      );
    }

    if (!existsSync(resolvedPath)) {
      throw new Error('The Firebase service-account file could not be found.');
    }

    try {
      return this.parseServiceAccountJson(readFileSync(resolvedPath, 'utf8'));
    } catch {
      throw new Error('The Firebase service-account file could not be read.');
    }
  }

  private parseServiceAccountJson(value: string): ServiceAccount {
    try {
      const parsed = JSON.parse(value) as ServiceAccount;
      if (typeof parsed.privateKey === 'string') {
        parsed.privateKey = parsed.privateKey.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch {
      throw new Error('Firebase service-account credentials are invalid JSON.');
    }
  }
}
