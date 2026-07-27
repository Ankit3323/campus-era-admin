import { NextResponse } from 'next/server';

// firebase-admin needs the Node runtime (crashes on Edge).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fix the two common Vercel private-key pitfalls: wrapping quotes + literal \n. */
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

/**
 * Load + init firebase-admin. Uses DYNAMIC imports so a bundling/load failure is
 * catchable here and returned as a readable error — instead of crashing the
 * whole route module at import time (which shows up as a bare HTTP 500).
 */
async function getAuthAdmin() {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  const missing: string[] = [];
  if (!projectId) missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
  if (missing.length) throw new Error('Missing env vars: ' + missing.join(', '));
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('FIREBASE_PRIVATE_KEY is malformed (no PEM header found).');
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getAuth(app);
}

/** Diagnostic — open /api/delete-user in a browser to see exactly what's wrong. */
export async function GET() {
  try {
    await getAuthAdmin();
    return NextResponse.json({ ok: true, message: 'firebase-admin initialized OK' });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || String(e),
        env: {
          projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          privateKeyPresent: !!process.env.FIREBASE_PRIVATE_KEY,
          privateKeyHasHeader: (process.env.FIREBASE_PRIVATE_KEY || '').includes('BEGIN PRIVATE KEY'),
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await request.json();
    if (!uid) return NextResponse.json({ error: 'Missing UID' }, { status: 400 });

    const auth = await getAuthAdmin();
    await auth.deleteUser(uid);
    console.log(`✅ Deleted Auth user: ${uid}`);
    return NextResponse.json({ success: true, message: `Deleted ${uid}` });
  } catch (error: any) {
    console.error('❌ delete-user error:', error);
    if (error?.code === 'auth/user-not-found') {
      return NextResponse.json({ success: true, message: 'User already deleted in Auth' });
    }
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
