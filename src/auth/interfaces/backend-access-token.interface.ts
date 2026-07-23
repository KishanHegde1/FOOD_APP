/**
 * Claims issued only after a Firebase identity has been verified and linked to
 * a shared backend user. Firebase UID is kept inside the signed token and is
 * never returned in the public profile response.
 */
export interface BackendAccessTokenPayload {
  sub: string;
  firebaseUid: string;
  phoneNumber: string;
  tokenType: 'access';
}

export interface IssuedBackendAccessToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
