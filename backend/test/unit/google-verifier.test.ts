import { describe, expect, it } from 'vitest';
import { SignJWT, UnsecuredJWT, exportJWK, generateKeyPair, createLocalJWKSet } from 'jose';
import { JoseGoogleVerifier } from '../../src/modules/identity/google-verifier.js';

const clientId = 'client-123.apps.googleusercontent.com';
const ISS = 'https://accounts.google.com';

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown>, o: { iss?: string; aud?: string; exp?: string | number; key?: CryptoKey } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(o.iss ?? ISS)
      .setAudience(o.aud ?? clientId)
      .setIssuedAt()
      .setExpirationTime(o.exp ?? '5m')
      .sign(o.key ?? privateKey);
  return { verifier: new JoseGoogleVerifier({ clientId, keys }), sign };
}

describe('JoseGoogleVerifier', () => {
  it('accepts a valid token and maps sub, email, email_verified, name', async () => {
    const { verifier, sign } = await setup();
    const token = await sign({ sub: 'g-1', email: 'a@b.co', email_verified: true, name: 'Ann' });
    expect(await verifier.verify(token)).toEqual({ subject: 'g-1', email: 'a@b.co', emailVerified: true, name: 'Ann' });
  });

  it('rejects wrong audience', async () => {
    const { verifier, sign } = await setup();
    await expect(verifier.verify(await sign({ sub: 'x', email: 'a@b.co' }, { aud: 'other' }))).rejects.toMatchObject({ code: 'INVALID_GOOGLE_TOKEN', statusCode: 401 });
  });

  it('rejects wrong issuer', async () => {
    const { verifier, sign } = await setup();
    await expect(verifier.verify(await sign({ sub: 'x', email: 'a@b.co' }, { iss: 'https://evil.example' }))).rejects.toMatchObject({ code: 'INVALID_GOOGLE_TOKEN' });
  });

  it('rejects expired token', async () => {
    const { verifier, sign } = await setup();
    await expect(verifier.verify(await sign({ sub: 'x', email: 'a@b.co' }, { exp: Math.floor(Date.now() / 1000) - 60 }))).rejects.toMatchObject({ code: 'INVALID_GOOGLE_TOKEN' });
  });

  it('rejects a token signed by another key', async () => {
    const { verifier, sign } = await setup();
    const other = await generateKeyPair('RS256');
    await expect(verifier.verify(await sign({ sub: 'x', email: 'a@b.co' }, { key: other.privateKey }))).rejects.toMatchObject({ code: 'INVALID_GOOGLE_TOKEN' });
  });

  it('rejects an HS256-signed token even when the key getter returns its secret', async () => {
    const secret = new TextEncoder().encode('0123456789abcdef0123456789abcdef');
    // createLocalJWKSet ignores oct keys, so use a getter that always returns the secret: only the algorithms allowlist can reject.
    const keys = async () => secret;
    const verifier = new JoseGoogleVerifier({ clientId, keys });
    const token = await new SignJWT({ sub: 'x', email: 'a@b.co' })
      .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
      .setIssuer(ISS).setAudience(clientId).setExpirationTime('5m')
      .sign(secret);
    await expect(verifier.verify(token)).rejects.toMatchObject({ code: 'INVALID_GOOGLE_TOKEN' });
  });

  it('rejects an unsigned (alg none) token', async () => {
    const { verifier } = await setup();
    const token = new UnsecuredJWT({ sub: 'x', email: 'a@b.co' })
      .setIssuer(ISS).setAudience(clientId).setExpirationTime('5m').encode();
    await expect(verifier.verify(token)).rejects.toMatchObject({ code: 'INVALID_GOOGLE_TOKEN' });
  });

  it('accepts issuer accounts.google.com without scheme', async () => {
    const { verifier, sign } = await setup();
    const token = await sign({ sub: 'g-2', email: 'a@b.co', email_verified: true }, { iss: 'accounts.google.com' });
    expect((await verifier.verify(token)).subject).toBe('g-2');
  });

  it('rejects a token missing sub', async () => {
    const { verifier, sign } = await setup();
    await expect(verifier.verify(await sign({ email: 'a@b.co' }))).rejects.toMatchObject({ code: 'INVALID_GOOGLE_TOKEN' });
  });

  it('does not leak the token in the error message', async () => {
    const { verifier, sign } = await setup();
    const token = await sign({ sub: 'x', email: 'a@b.co' }, { aud: 'other' });
    const rejection = expect(verifier.verify(token)).rejects;
    await rejection.toThrow();
    await rejection.not.toThrow(token);
    await rejection.not.toThrow(token.split('.')[1]!);
  });
});
