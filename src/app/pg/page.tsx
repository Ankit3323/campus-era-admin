"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Building2, Trash2, Search, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function PGPage() {
  const [pgs, setPgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchPGs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'rooms'));
      setPgs(snap.docs.map(d => ({ id: d.id, status: 'approved', ...d.data() })));
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPGs(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this PG listing?')) return;
    try { await deleteDoc(doc(db, 'rooms', id)); fetchPGs(); }
    catch { alert('Failed to delete'); }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'rooms', id), { status: newStatus });
      fetchPGs();
    } catch { alert('Failed to update status'); }
  };

  const filteredPGs = pgs.filter(pg => 
    (pg.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (pg.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(pg => statusFilter === 'all' || pg.status === statusFilter);

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0CA4A5, #34D399)' }}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">PG & Room Listings</h1>
              <p className="text-sm text-slate-500">{filteredPGs.length} total listings</p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm shadow-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm shadow-sm outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-header-gradient text-white text-xs uppercase font-semibold">
                  <th className="px-6 py-4">Title / Owner</th>
                  <th className="px-6 py-4">Rent</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#0CA4A5' }} />
                  </td></tr>
                ) : filteredPGs.map((pg) => (
                  <tr key={pg.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{pg.title || 'Untitled'}</div>
                      <div className="text-slate-500 text-xs">{pg.ownerName || 'Unknown Owner'}</div>
                    </td>
                    <td className="px-6 py-4"><span className="font-semibold text-slate-800">₹{pg.rent || 0}</span></td>
                    <td className="px-6 py-4 text-slate-600">{pg.location || 'Not specified'}</td>
                    <td className="px-6 py-4">
                      {pg.status === 'pending' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium"><Clock className="w-3 h-3"/> Pending</span>}
                      {pg.status === 'approved' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium"><CheckCircle className="w-3 h-3"/> Approved</span>}
                      {pg.status === 'rejected' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium"><XCircle className="w-3 h-3"/> Rejected</span>}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {pg.status !== 'approved' && (
                        <button onClick={() => handleUpdateStatus(pg.id, 'approved')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      {pg.status !== 'rejected' && (
                        <button onClick={() => handleUpdateStatus(pg.id, 'rejected')} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Reject">
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(pg.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Permanently">
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
    </ProtectedRoute>
  );
}
