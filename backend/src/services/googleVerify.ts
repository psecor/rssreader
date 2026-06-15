import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
}

/**
 * Verifies a Google ID token (as obtained by the Android client via
 * Credential Manager) and returns the subject + email if valid.
 *
 * Audience must match GOOGLE_CLIENT_ID — the same web OAuth client used by
 * the browser flow. Credential Manager on Android receives ID tokens whose
 * `aud` claim is the value passed as `serverClientId`, which we set to the
 * web client ID. Registering a separate Android OAuth client is still
 * required, but only to authorize the app to obtain credentials.
 */
export async function verifyGoogleIdToken(
  idToken: string
): Promise<VerifiedGoogleIdentity> {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
    throw new Error('GOOGLE_CLIENT_ID must be set to verify ID tokens');
  }

  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Google ID token missing required claims');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
  };
}
