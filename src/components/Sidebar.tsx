"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Building2,
  UtensilsCrossed,
  LogOut,
  Megaphone,
  ShieldCheck,
  ShoppingBag,
  SearchCode,
  UserX,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Banned Users', href: '/banned-users', icon: UserX },
  { name: 'Feed & Reports', href: '/feed', icon: AlertTriangle },
  { name: 'Market Items', href: '/market', icon: ShoppingBag },
  { name: 'PG Listings', href: '/pg', icon: Building2 },
  { name: 'Mess Services', href: '/mess', icon: UtensilsCrossed },
  { name: 'Lost & Found', href: '/lost-found', icon: SearchCode },
  { name: 'Notices', href: '/notices', icon: Megaphone },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { handleLogout, isSuperAdmin } = useAuth();

  const navItems = isSuperAdmin 
    ? [...navigation, { name: 'Manage Admins', href: '/admins', icon: ShieldCheck }]
    : navigation;

  return (
    <div className="flex h-full w-64 flex-col gradient-sidebar">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-white/10">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{
          background: 'linear-gradient(135deg, #FF4D6D, #FF8C42, #3B82F6, #8B5CF6)'
        }}>
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <span className="ml-3 text-lg font-bold text-white tracking-tight">CampusEra</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col px-4 py-6 overflow-y-auto">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Menu</p>
            <ul role="list" className="-mx-2 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`
                        group flex gap-x-3 rounded-xl px-3 py-2.5 text-sm leading-6 font-medium transition-all duration-200
                        ${isActive
                          ? 'text-white shadow-lg'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }
                      `}
                      style={isActive ? {
                        background: 'linear-gradient(135deg, #FF4D6D, #FF8C42, #3B82F6)'
                      } : {}}
                    >
                      <item.icon
                        className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
          <li className="mt-auto">
            <button
              onClick={handleLogout}
              className="group -mx-2 flex w-full gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium leading-6 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
            >
              <LogOut className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-red-400" aria-hidden="true" />
              Sign out
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
