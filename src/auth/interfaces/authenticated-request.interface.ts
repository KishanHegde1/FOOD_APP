import { Request } from 'express';
import { FirebaseUser } from './firebase-user.interface';

export interface AuthenticatedRequest extends Request {
  firebaseUser?: FirebaseUser;
}
