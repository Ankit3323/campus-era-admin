"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Megaphone, Trash2, Plus, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function NoticesPage() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'notices'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotices(data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotices(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'notices'), {
        title: title.trim(),
        message: message.trim(),
        imageUrl: imageUrl.trim() || '',
        imageUrls: [],
        adminId: user?.uid || '',
        senderType: 'admin',
        likedBy: [],
        comments: [],
        likeCount: 0,
        commentCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      // Broadcast to all users via new Render API endpoint
      fetch('https://campusera-notification-server.onrender.com/sendBroadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "📢 " + title.trim(),
          body: message.trim(),
          senderId: user?.uid || 'admin',
          type: 'notice'
        })
      })
      .then(res => res.json())
      .then(data => console.log('Broadcast response:', data))
      .catch(err => console.error('Notification error:', err));

      setTitle(''); setMessage(''); setImageUrl(''); setShowForm(false);
      fetchNotices();
    } catch (error) { alert('Failed to create notice'); console.error(error); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notice?')) return;
    try { await deleteDoc(doc(db, 'notices', id)); fetchNotices(); }
    catch { alert('Failed to delete'); }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}>
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Admin Notices</h1>
              <p className="text-sm text-slate-500">{notices.length} total notices</p>
            </div>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}>
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Notice'}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
              <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={4}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Image URL (optional)</label>
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm"
                placeholder="https://..." />
            </div>
            <button type="submit" disabled={submitting}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-70" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}>
              {submitting ? 'Publishing...' : 'Publish Notice'}
            </button>
          </form>
        )}

        {/* Notices List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#8B5CF6' }} /></div>
          ) : notices.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900">No notices yet</h3>
              <p className="text-slate-500 mt-1">Create your first admin notice.</p>
            </div>
          ) : notices.map((notice) => (
            <div key={notice.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-lg">{notice.title}</h3>
                  <p className="text-slate-600 mt-2 text-sm leading-relaxed">{notice.message}</p>
                  {notice.imageUrl && (
                    <img src={notice.imageUrl} alt="" className="mt-3 rounded-xl max-h-48 object-cover" />
                  )}
                  <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                    <span>❤️ {notice.likeCount || 0} likes</span>
                    <span>💬 {notice.commentCount || 0} comments</span>
                    <span>{notice.createdAt ? new Date(notice.createdAt.seconds * 1000).toLocaleDateString() : ''}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(notice.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-4">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
