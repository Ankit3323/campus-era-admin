"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Ban, Trash2, Unlock, ShieldAlert, Search, Users, Plus, X, CheckCircle, XCircle } from 'lucide-react';

interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  blocked?: boolean;
  isVerifiedOwner?: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add Owner State
  const [showAddOwnerModal, setShowAddOwnerModal] = useState(false);
  const [newOwnerData, setNewOwnerData] = useState({ name: '', email: '', password: '', type: 'pg_owner' });
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);

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

  const handleToggleBlock = async (userId: string, currentStatus: boolean, email?: string) => {
    if (!confirm(`${currentStatus ? 'Unblock' : 'Block'} this user?`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), { blocked: !currentStatus });
      // If unblocking, make sure we also remove them from banned_emails
      if (currentStatus && email) {
        await deleteDoc(doc(db, 'banned_emails', email));
      }
      fetchUsers();
    } catch { alert('Failed to update'); }
  };

  const handleToggleVerification = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'revoke verification for' : 'verify'} this owner?`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), { isVerifiedOwner: !currentStatus });
      fetchUsers();
    } catch {
      alert('Failed to update verification status');
    }
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
      
      // We block the user in Firestore instead of deleting them. 
      // This prevents the flutter app from auto-creating a new document if they log in again,
      // and properly triggers the "Account Blocked" error.
      await updateDoc(doc(db, 'users', user.id), { blocked: true });
      fetchUsers();
    } catch { alert('Failed to ban'); }
  };

  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingOwner(true);
    try {
      // 1. Initialize secondary app to avoid logging out the current admin
      const adminAppName = 'AdminCreatorApp';
      const apps = getApps();
      let adminApp = apps.find(a => a.name === adminAppName);
      if (!adminApp) {
        const defaultApp = getApp();
        adminApp = initializeApp(defaultApp.options, adminAppName);
      }
      
      const adminAuth = getAuth(adminApp);
      
      // 2. Create the user
      const userCredential = await createUserWithEmailAndPassword(adminAuth, newOwnerData.email, newOwnerData.password);
      const newUserId = userCredential.user.uid;
      
      // 3. Create the user doc in Firestore
      await setDoc(doc(db, 'users', newUserId), {
        id: newUserId,
        name: newOwnerData.name,
        email: newOwnerData.email,
        role: 'owner',
        ownerType: newOwnerData.type,
        isPremium: true,
        profileCompleted: false,
        isVerifiedOwner: true,
        createdat: new Date().toISOString()
      });
      
      // 4. Cleanup auth
      await signOut(adminAuth);
      
      // 5. Success
      alert('Owner account created successfully!');
      setShowAddOwnerModal(false);
      setNewOwnerData({ name: '', email: '', password: '', type: 'pg_owner' });
      fetchUsers();
    } catch (error: any) {
      alert(`Error creating owner: ${error.message}`);
    } finally {
      setIsCreatingOwner(false);
    }
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAddOwnerModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Owner
            </button>
            <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold">
              {filteredUsers.length} users
            </span>
          </div>
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
                      {u.role === 'owner' && (
                        <span className={`ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${u.isVerifiedOwner ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {u.isVerifiedOwner ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {u.isVerifiedOwner ? 'Verified' : 'Pending'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {u.role === 'owner' && (
                        <button onClick={() => handleToggleVerification(u.id, u.isVerifiedOwner || false)}
                          className={`p-2 rounded-lg transition-colors ${u.isVerifiedOwner ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:bg-slate-50'}`}
                          title={u.isVerifiedOwner ? 'Revoke Verification' : 'Verify Owner'}>
                          {u.isVerifiedOwner ? <CheckCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </button>
                      )}
                      <button onClick={() => handleToggleBlock(u.id, u.blocked || false, u.email)}
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

      {/* Add Owner Modal */}
      {showAddOwnerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add Owner Manually</h3>
              <button onClick={() => setShowAddOwnerModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddOwner} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Owner Name</label>
                <input
                  required
                  type="text"
                  value={newOwnerData.name}
                  onChange={e => setNewOwnerData({...newOwnerData, name: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  placeholder="e.g. John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={newOwnerData.email}
                  onChange={e => setNewOwnerData({...newOwnerData, email: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  placeholder="e.g. john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={newOwnerData.password}
                  onChange={e => setNewOwnerData({...newOwnerData, password: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Property Type</label>
                <select
                  value={newOwnerData.type}
                  onChange={e => setNewOwnerData({...newOwnerData, type: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white"
                >
                  <option value="pg_owner">PG / Room Owner</option>
                  <option value="mess_owner">Mess Service Owner</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddOwnerModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOwner}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 flex justify-center"
                >
                  {isCreatingOwner ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
