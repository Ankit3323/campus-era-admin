"use client";

import { useAuth } from '@/context/AuthContext';
import { Bell } from 'lucide-react';

export default function Topbar() {
  const { user } = useAuth();

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/80 backdrop-blur-xl px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Page Title Area */}
        <div className="flex flex-1 items-center">
          <h2 className="text-lg font-semibold text-slate-800">Admin Dashboard</h2>
        </div>

        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notification Bell */}
          <button type="button" className="relative -m-2.5 p-2.5 text-slate-400 hover:text-slate-600 transition-colors">
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full" style={{
              background: 'linear-gradient(135deg, #FF4D6D, #FF8C42)'
            }} />
          </button>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" aria-hidden="true" />

          {/* Profile */}
          <div className="flex items-center gap-x-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="h-8 w-8 rounded-full ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{
                background: 'linear-gradient(135deg, #FF4D6D, #3B82F6)'
              }}>
                {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
            )}
            <span className="hidden lg:flex lg:items-center">
              <span className="text-sm font-semibold leading-6 text-slate-900">
                {user?.displayName || user?.email || 'Admin'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
