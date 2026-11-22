import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppError } from '../../shared/errors.js';

export interface GoogleProfile {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** Verifies a Google ID token. Rejects with AppError(401, INVALID_GOOGLE_TOKEN) on any failure. */
export interface GoogleVerifier {
  verify(idToken: string): Promise<GoogleProfile>;
}

const invalid = () => new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in could not be verified.');

export class JoseGoogleVerifier implements GoogleVerifier {
  private readonly keys: JWTVerifyGetKey;
  private readonly clientId: string;

  constructor(opts: { clientId: string; keys?: JWTVerifyGetKey }) {
    this.clientId = opts.clientId;
    this.keys = opts.keys ?? createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    try {
      const { payload } = await jwtVerify(idToken, this.keys, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: this.clientId,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'sub'],
        clockTolerance: 5,
      });
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw invalid();
      return {
        subject: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        name: typeof payload.name === 'string' ? payload.name : null,
      };
    } catch {
      throw invalid();
    }
  }
}

/** Test driver: maps known token strings to profiles. */
export class FakeGoogleVerifier implements GoogleVerifier {
  readonly tokens = new Map<string, GoogleProfile>();
  async verify(idToken: string): Promise<GoogleProfile> {
    const profile = this.tokens.get(idToken);
    if (!profile) throw invalid();
    return profile;
  }
}

/** Used when GOOGLE_CLIENT_ID is not configured. */
export class DisabledGoogleVerifier implements GoogleVerifier {
  async verify(): Promise<GoogleProfile> {
    throw new AppError(503, 'GOOGLE_SIGN_IN_DISABLED', 'Google sign-in is not configured.');
  }
}
