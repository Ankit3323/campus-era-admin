"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Ban, Trash2, Unlock, ShieldAlert, Search, Users } from 'lucide-react';

interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  blocked?: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`${currentStatus ? 'Unblock' : 'Block'} this user?`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), { blocked: !currentStatus });
      fetchUsers();
    } catch { alert('Failed to update'); }
  };

  const handleBanUser = async (user: User) => {
    if (!confirm(`Permanently ban ${user.name}?`)) return;
    try {
      if (user.email) {
        await setDoc(doc(db, 'banned_emails', user.email), {
          email: user.email, userId: user.id, userName: user.name || '',
          reason: 'Banned by admin', bannedAt: new Date(),
        });
      }
      await deleteDoc(doc(db, 'users', user.id));
      fetchUsers();
    } catch { alert('Failed to ban'); }
  };

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role?: string) => {
    switch(role) {
      case 'admin': return { bg: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', text: 'white' };
      case 'owner': return { bg: 'linear-gradient(135deg, #34D399, #059669)', text: 'white' };
      default: return { bg: 'linear-gradient(135deg, #3B82F6, #2563EB)', text: 'white' };
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Manage Users</h1>
          </div>
          <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">
            {filteredUsers.length} users
          </span>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-header-gradient text-white text-xs uppercase font-semibold">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  </td></tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{u.name || 'Unknown'}</div>
                      <div className="text-slate-500 text-xs">{u.email || 'No email'}</div>
                      {u.phone && <div className="text-xs text-slate-400">{u.phone}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold capitalize text-white" style={{ background: getRoleBadge(u.role).bg }}>
                        {u.role || 'student'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.blocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          <Ban className="w-3 h-3" /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                          <Unlock className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleToggleBlock(u.id, u.blocked || false)}
                        className={`p-2 rounded-lg transition-colors ${u.blocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}
                        title={u.blocked ? 'Unblock' : 'Block'}>
                        {u.blocked ? <Unlock className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                      </button>
                      <button onClick={() => handleBanUser(u)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Permanently Ban">
                        <ShieldAlert className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
