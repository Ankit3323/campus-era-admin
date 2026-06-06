"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Users, Building2, UtensilsCrossed, MessageSquare, TrendingUp, Eye } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, pg: 0, mess: 0, posts: 0, reports: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersSnap, pgSnap, messSnap, postsSnap, reportsSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'rooms')),
          getCountFromServer(collection(db, 'mess')),
          getCountFromServer(collection(db, 'discussions')),
          getCountFromServer(query(collection(db, 'reported_posts'), where('status', '==', 'pending'))),
        ]);
        setStats({
          users: usersSnap.data().count,
          pg: pgSnap.data().count,
          mess: messSnap.data().count,
          posts: postsSnap.data().count,
          reports: reportsSnap.data().count,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const statCards = [
    { name: 'Total Users', value: stats.users, icon: Users, gradient: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', shadow: 'rgba(59,130,246,0.3)' },
    { name: 'Feed Posts', value: stats.posts, icon: MessageSquare, gradient: 'linear-gradient(135deg, #FF4D6D, #FF8C42)', shadow: 'rgba(255,77,109,0.3)' },
    { name: 'PG Listings', value: stats.pg, icon: Building2, gradient: 'linear-gradient(135deg, #0CA4A5, #34D399)', shadow: 'rgba(12,164,165,0.3)' },
    { name: 'Mess Services', value: stats.mess, icon: UtensilsCrossed, gradient: 'linear-gradient(135deg, #FF8C42, #FFC371)', shadow: 'rgba(255,140,66,0.3)' },
  ];

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.displayName?.split(' ')[0] || 'Admin'} 👋
          </h1>
          <p className="text-slate-500 mt-1">Here's what's happening on CampusEra today.</p>
        </div>

        {/* Stat Cards */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-pulse h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <div key={stat.name} className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg transition-transform hover:scale-[1.02]" style={{
                background: stat.gradient,
                boxShadow: `0 10px 30px ${stat.shadow}`,
              }}>
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 -mr-8 -mt-8" />
                <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 -ml-4 -mb-4" />
                <stat.icon className="h-8 w-8 text-white/80 mb-4" />
                <p className="text-white/80 text-sm font-medium">{stat.name}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pending Reports Alert */}
        {!loading && stats.reports > 0 && (
          <div className="mt-8 rounded-2xl p-6 border border-red-200 bg-red-50/50 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
              <Eye className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900">Attention Required</h3>
              <p className="text-red-700 text-sm">{stats.reports} reported post{stats.reports > 1 ? 's' : ''} pending review. <a href="/feed" className="underline font-medium">Review now →</a></p>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
