import { Injectable, ConflictException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  // H6: convert the silent-link block into a user-friendly 409 with guidance.
  // Strategy throws Error('ACCOUNT_EXISTS_NO_LINK') when Google email matches
  // an existing local-password account.
  handleRequest<T>(err: Error | null, user: T): T {
    if (err?.message === 'ACCOUNT_EXISTS_NO_LINK') {
      throw new ConflictException(
        'An account with this email already exists. Sign in with your password, ' +
          'then link Google from your account settings.',
      );
    }
    if (err || !user) {
      throw err || new Error('Google authentication failed');
    }
    return user;
  }
}
