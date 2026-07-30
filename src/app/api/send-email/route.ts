import { NextResponse } from 'next/server';

// firebase-admin needs the Node runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SENDER = { name: 'Campus Era', email: 'mail@campusera.in' };

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

async function getAdminApp() {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin env vars are missing on the server.');
  }
  return getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

/** Only the main admin(s) from NEXT_PUBLIC_ADMIN_EMAILS may send mail. */
function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'ankitanand5675@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate the caller and enforce "main admin only" ON THE SERVER.
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Missing auth token.' }, { status: 401 });
    }
    const app = await getAdminApp();
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth(app).verifyIdToken(token);
    if (!isSuperAdminEmail(decoded.email)) {
      return NextResponse.json(
        { error: 'Only the main admin can send emails.' },
        { status: 403 },
      );
    }

    // 2. Validate payload.
    const { subject, html, emails } = await request.json();
    if (!subject?.trim() || !html?.trim()) {
      return NextResponse.json(
        { error: 'Subject and HTML body are required.' },
        { status: 400 },
      );
    }
    const recipients: string[] = Array.from(
      new Set(
        (Array.isArray(emails) ? emails : [])
          .map((e: string) => (e || '').trim().toLowerCase())
          .filter((e: string) => e.includes('@') && e.includes('.')),
      ),
    );
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients selected.' }, { status: 400 });
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'BREVO_API_KEY is not configured on the server.' },
        { status: 500 },
      );
    }

    // 3. Send via Brevo. Each recipient gets their OWN email (messageVersions),
    // so nobody sees anyone else's address. Batched to respect Brevo limits.
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const BATCH = 500;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const chunk = recipients.slice(i, i + BATCH);
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            sender: SENDER,
            subject,
            htmlContent: html,
            messageVersions: chunk.map((email) => ({ to: [{ email }] })),
          }),
        });
        if (res.ok) {
          sent += chunk.length;
        } else {
          failed += chunk.length;
          const body = await res.text();
          errors.push(`HTTP ${res.status}: ${body.slice(0, 300)}`);
        }
      } catch (e: any) {
        failed += chunk.length;
        errors.push(e?.message || String(e));
      }
    }

    return NextResponse.json({
      success: failed === 0,
      sent,
      failed,
      total: recipients.length,
      errors: errors.slice(0, 5),
    });
  } catch (error: any) {
    console.error('send-email error:', error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
