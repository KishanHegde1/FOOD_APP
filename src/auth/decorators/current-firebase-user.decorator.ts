import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

export const CurrentFirebaseUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.firebaseUser) {
      throw new UnauthorizedException('Firebase authentication is required.');
    }

    return request.firebaseUser;
  },
);
