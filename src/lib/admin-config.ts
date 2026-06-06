import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  // Read from .env or fallback to default
  const superAdmins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'ankitanand5675@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase());
  return superAdmins.includes(email.toLowerCase());
}

export async function isAllowedAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  
  // 1. Check if they are a super admin (env variables)
  if (isSuperAdmin(email)) {
    return true;
  }

  // 2. Check if they are listed in the 'admins' collection in Firestore
  try {
    const adminDoc = await getDoc(doc(db, 'admins', email.toLowerCase()));
    return adminDoc.exists();
  } catch (error) {
    console.error("Error checking admin status in Firestore:", error);
    return false;
  }
}
