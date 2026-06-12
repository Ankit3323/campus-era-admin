import { NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin if it hasn't been initialized yet
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: 'Missing UID' }, { status: 400 });
    }

    // Attempt to delete the user from Firebase Authentication
    await getAuth().deleteUser(uid);
    console.log(`✅ Successfully deleted Auth user: ${uid}`);

    return NextResponse.json({ success: true, message: `Successfully deleted user ${uid}` });
  } catch (error: any) {
    console.error('❌ Error deleting auth user:', error);
    
    // If the user already doesn't exist in Auth, we can consider this step successful
    // so the admin portal can continue cleaning up Firestore data.
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ success: true, message: 'User already deleted in Auth' });
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
