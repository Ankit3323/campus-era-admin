import { NextResponse } from 'next/server';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Normalize the private key from an env var. Handles the two most common Vercel
 * pitfalls: the value being wrapped in quotes, and newlines stored as literal
 * "\n" instead of real line breaks.
 */
function normalizePrivateKey(raw?: string): string {
  let key = (raw ?? '').trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

/** Lazily init the Admin app so credential errors surface as a clear response. */
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  const missing: string[] = [];
  if (!projectId) missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
  if (missing.length) {
    throw new Error('Missing env vars: ' + missing.join(', '));
  }
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY is malformed (no PEM header found). Re-paste the ' +
      'full private_key value from the service-account JSON.'
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export async function POST(request: Request) {
  try {
    const { uid } = await request.json();
    if (!uid) {
      return NextResponse.json({ error: 'Missing UID' }, { status: 400 });
    }

    const app = getAdminApp(); // throws a descriptive error if creds are bad
    await getAuth(app).deleteUser(uid);
    console.log(`✅ Deleted Auth user: ${uid}`);
    return NextResponse.json({ success: true, message: `Deleted ${uid}` });
  } catch (error: any) {
    console.error('❌ delete-user error:', error);
    // Already gone in Auth → treat as success so Firestore cleanup proceeds.
    if (error?.code === 'auth/user-not-found') {
      return NextResponse.json({ success: true, message: 'User already deleted in Auth' });
    }
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
