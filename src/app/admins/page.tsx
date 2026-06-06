"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, setDoc, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, Plus, X, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isSuperAdmin } from '@/lib/admin-config';

export default function AdminsPage() {
  const { user, isSuperAdmin: isSuper } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'admins'));
      setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    if (isSuper) {
      fetchAdmins();
    }
  }, [isSuper]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    
    const email = newEmail.trim().toLowerCase();
    
    // Check if it's already a super admin
    if (isSuperAdmin(email)) {
      alert('This email is already a Super Admin via environment variables.');
      return;
    }
    
    setSubmitting(true);
    try {
      // Use email as the document ID for easy lookup
      await setDoc(doc(db, 'admins', email), {
        email: email,
        addedBy: user?.email || '',
        addedAt: Timestamp.now(),
      });
      setNewEmail(''); 
      setShowForm(false);
      fetchAdmins();
    } catch (error) { alert('Failed to add admin'); console.error(error); }
    finally { setSubmitting(false); }
  };

  const handleRemove = async (email: string) => {
    if (!confirm(`Revoke admin access for ${email}?`)) return;
    try { 
      await deleteDoc(doc(db, 'admins', email)); 
      fetchAdmins(); 
    }
    catch { alert('Failed to remove admin'); }
  };

  if (!isSuper) {
    return (
      <ProtectedRoute>
        <div className="p-8 text-center">
          <ShieldCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
          <p className="text-slate-500 mt-2">Only Super Admins can manage other admins.</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Manage Admins</h1>
              <p className="text-sm text-slate-500">Add or revoke admin access for team members</p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Add Admin'}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <form onSubmit={handleAddAdmin} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-8">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Google Email Address</label>
                <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm" 
                  placeholder="colleague@gmail.com" />
              </div>
              <button type="submit" disabled={submitting}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-70 h-[46px]" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                {submitting ? 'Adding...' : 'Grant Access'}
              </button>
            </div>
          </form>
        )}

        {/* Super Admins List (Static) */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 px-1">Super Admins</h2>
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">ankitanand5675@gmail.com</p>
                <p className="text-xs text-slate-500">Configured via environment variables (Cannot be removed here)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Admins List */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 px-1">Dashboard Admins</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                    <th className="px-6 py-4">Email Address</th>
                    <th className="px-6 py-4">Added By</th>
                    <th className="px-6 py-4">Added On</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                    </td></tr>
                  ) : admins.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No additional admins configured.
                    </td></tr>
                  ) : admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{admin.email}</td>
                      <td className="px-6 py-4 text-slate-500">{admin.addedBy || 'Unknown'}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {admin.addedAt ? new Date(admin.addedAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRemove(admin.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Revoke Access">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
