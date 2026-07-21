export interface FirebaseUser {
  uid: string;
  phoneNumber: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
}
