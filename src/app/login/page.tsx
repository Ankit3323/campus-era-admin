"use client";

import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { isAllowedAdmin } from '@/lib/admin-config';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      if (!isAllowedAdmin(result.user.email)) {
        await signOut(auth);
        setError('Access denied. This Google account is not authorized as admin.');
        setLoading(false);
        return;
      }

      router.push('/');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('');
      } else {
        setError(err.message || 'Failed to sign in');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #FFF1F2 0%, #FFF7ED 30%, #EFF6FF 60%, #F5F3FF 100%)'
    }}>
      <div className="w-full max-w-md bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-white/60 p-8 sm:p-12">
        <div className="flex justify-center mb-8">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg" style={{
            background: 'linear-gradient(135deg, #FF4D6D, #FF8C42, #3B82F6, #8B5CF6)'
          }}>
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CampusEra Admin</h1>
          <p className="text-sm text-slate-500 mt-2">Sign in with your authorized Google account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-semibold transition-all shadow-md disabled:opacity-70 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #FF4D6D, #FF8C42, #3B82F6)'
          }}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <p className="text-xs text-center text-slate-400 mt-6">
          Only authorized admin accounts can access this portal.
        </p>
      </div>
    </div>
  );
}
