"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { isAllowedAdmin, isSuperAdmin } from '@/lib/admin-config';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isSuperAdmin: false,
  loading: true,
  handleLogout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminState, setIsAdminState] = useState(false);
  const [isSuperAdminState, setIsSuperAdminState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        // Run the async check
        const allowed = await isAllowedAdmin(firebaseUser.email);
        
        if (allowed) {
          setUser(firebaseUser);
          setIsAdminState(true);
          setIsSuperAdminState(isSuperAdmin(firebaseUser.email));
        } else {
          // If they managed to log in with Google but are not authorized, log them out
          await signOut(auth);
          setUser(null);
          setIsAdminState(false);
          setIsSuperAdminState(false);
        }
      } else {
        setUser(null);
        setIsAdminState(false);
        setIsSuperAdminState(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setIsAdminState(false);
    setIsSuperAdminState(false);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAdmin: isAdminState, 
      isSuperAdmin: isSuperAdminState, 
      loading, 
      handleLogout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
