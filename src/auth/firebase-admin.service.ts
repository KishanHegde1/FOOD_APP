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

type RawFirebaseServiceAccount = {
  project_id?: unknown;
  client_email?: unknown;
  private_key?: unknown;
};

const RENDER_SECRET_DIR = resolve('/etc/secrets');

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
    if (getApps().length > 0) {
      this.app = getApps()[0]!;
      return;
    }

    const serviceAccount = this.loadServiceAccount();

    this.app = initializeApp({ credential: cert(serviceAccount) });
  }

  loadServiceAccount(): ServiceAccount {
    const serviceAccountJson = this.getCredentialSetting(
      'firebase.serviceAccountJson',
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    if (serviceAccountJson?.trim()) {
      return this.parseServiceAccountJson(serviceAccountJson);
    }

    const serviceAccountPath = this.getCredentialSetting(
      'firebase.serviceAccountPath',
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );
    if (!serviceAccountPath) {
      throw new Error(
        'Firebase Admin credentials are required. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.',
      );
    }

    const resolvedPath = this.resolveServiceAccountPath(serviceAccountPath);

    if (!existsSync(resolvedPath)) {
      throw new Error('The Firebase service-account file could not be found.');
    }

    let serviceAccountFile: string;
    try {
      serviceAccountFile = readFileSync(resolvedPath, 'utf8');
    } catch {
      throw new Error('The Firebase service-account file could not be read.');
    }

    return this.parseServiceAccountJson(serviceAccountFile);
  }

  resolveServiceAccountPath(value: string): string {
    const trimmed = value.trim();
    const resolvedPath = isAbsolute(trimmed)
      ? resolve(trimmed)
      : resolve(process.cwd(), trimmed);

    if (isAbsolute(trimmed)) {
      const pathFromRenderSecrets = relative(RENDER_SECRET_DIR, resolvedPath);
      const isRenderSecretPath =
        !pathFromRenderSecrets.startsWith('..') &&
        !isAbsolute(pathFromRenderSecrets);
      if (!isRenderSecretPath) {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT_PATH absolute paths must resolve inside /etc/secrets.',
        );
      }
      return resolvedPath;
    }

    const projectRoot = resolve(process.cwd());
    const pathFromRoot = relative(projectRoot, resolvedPath);
    if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_PATH must resolve inside the project root.',
      );
    }

    return resolvedPath;
  }

  private getCredentialSetting(
    namespacedKey: string,
    legacyKey: string,
  ): string | undefined {
    const configured = this.configService.get<string>(namespacedKey);
    if (configured?.trim()) return configured;

    // Retain compatibility for isolated tests and modules that provide only
    // the original environment-variable keys through ConfigService.
    return this.configService.get<string>(legacyKey);
  }

  private parseServiceAccountJson(value: string): ServiceAccount {
    let parsed: RawFirebaseServiceAccount;
    try {
      parsed = JSON.parse(value) as RawFirebaseServiceAccount;
    } catch {
      throw new Error('Firebase service-account credentials are invalid JSON.');
    }

    if (
      typeof parsed.project_id !== 'string' ||
      !parsed.project_id.trim() ||
      typeof parsed.client_email !== 'string' ||
      !parsed.client_email.trim() ||
      typeof parsed.private_key !== 'string' ||
      !parsed.private_key.trim()
    ) {
      throw new Error(
        'Firebase service-account credentials must include project_id, client_email, and private_key.',
      );
    }

    return {
      projectId: parsed.project_id.trim(),
      clientEmail: parsed.client_email.trim(),
      privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    };
  }
}
