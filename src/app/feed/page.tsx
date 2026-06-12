"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle, Shield, MessageSquare, Search, UserX, Ban } from 'lucide-react';

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({
  open, title, message, confirmLabel, danger,
  onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string;
  confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-200">
        <div className="flex items-center gap-3 mb-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'reports'>('posts');
  const [searchQuery, setSearchQuery] = useState('');

  // Confirm dialog state
  const [dialog, setDialog] = useState<{
    open: boolean; title: string; message: string;
    confirmLabel: string; danger?: boolean; onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: '', onConfirm: () => {} });

  const showConfirm = (opts: Omit<typeof dialog, 'open'>) =>
    setDialog({ ...opts, open: true });
  const closeDialog = () => setDialog(d => ({ ...d, open: false }));

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsSnap, postsSnap] = await Promise.all([
        getDocs(collection(db, 'reported_posts')),
        getDocs(collection(db, 'discussions')),
      ]);

      const rawReports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const userIds = new Set<string>();
      rawReports.forEach((r: any) => {
        if (r.postAuthorId) userIds.add(r.postAuthorId);
        if (r.reportedByUserId) userIds.add(r.reportedByUserId);
      });

      const usersMap = new Map();
      await Promise.all(Array.from(userIds).map(async (uid) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) usersMap.set(uid, { id: userSnap.id, ...userSnap.data() });
        } catch { console.error('Failed to fetch user:', uid); }
      }));

      const pendingGroupsMap = new Map();
      rawReports.filter((r: any) => r.status === 'pending').forEach((r: any) => {
        if (!pendingGroupsMap.has(r.postId)) {
          pendingGroupsMap.set(r.postId, {
            postId: r.postId,
            postContent: r.postContent,
            postAuthorId: r.postAuthorId,
            postAuthor: usersMap.get(r.postAuthorId) || {},
            reportIds: [],
            reporters: [],
          });
        }
        const group = pendingGroupsMap.get(r.postId);
        group.reportIds.push(r.id);
        const reporterUser = usersMap.get(r.reportedByUserId) || {};
        group.reporters.push({
          reportId: r.id,
          userId: r.reportedByUserId,
          reason: r.reason,
          name: reporterUser.name || 'Unknown',
          email: reporterUser.email || 'No email',
        });
      });
      setReports(Array.from(pendingGroupsMap.values()));

      let postsData = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      postsData.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(postsData);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDismissAll = async (reportIds: string[]) => {
    try {
      await Promise.all(reportIds.map(id => updateDoc(doc(db, 'reported_posts', id), { status: 'dismissed' })));
      fetchData();
    } catch { alert('Failed to dismiss'); }
  };

  const handleDeletePost = async (postId: string, reportIds?: string[]) => {
    showConfirm({
      title: 'Delete Post',
      message: 'This will permanently delete the post. This action cannot be undone.',
      confirmLabel: 'Delete Post',
      danger: true,
      onConfirm: async () => {
        closeDialog();
        try {
          await deleteDoc(doc(db, 'discussions', postId));
          if (reportIds?.length) {
            await Promise.all(reportIds.map(id =>
              updateDoc(doc(db, 'reported_posts', id), { status: 'deleted_post' })
            ));
          }
          fetchData();
        } catch { alert('Failed to delete post'); }
      },
    });
  };

  /**
   * Ban a user — sets banned:true on their user doc.
   * They can still sign in but your app should check this flag and block access.
   */
  const handleBanUser = async (userId: string, userName: string) => {
    if (!userId) { alert('No user ID found for this post.'); return; }
    showConfirm({
      title: 'Ban User',
      message: `Ban "${userName}"? Their account will be flagged as banned. They will not be able to use the app. You can unban them later from Firestore.`,
      confirmLabel: 'Ban User',
      danger: false,
      onConfirm: async () => {
        closeDialog();
        try {
          await updateDoc(doc(db, 'users', userId), {
            banned: true,
            bannedAt: new Date().toISOString(),
          });
          alert(`${userName} has been banned.`);
          fetchData();
        } catch { alert('Failed to ban user'); }
      },
    });
  };

  /**
   * Delete Account — nukes everything:
   *  • users/{uid}
   *  • All discussions where authorId == uid
   *  • All reported_posts where postAuthorId == uid OR reportedByUserId == uid
   *
   * Note: Firebase Auth account deletion requires the Admin SDK (server-side).
   * This deletes all Firestore data. The user can re-register freely.
   * To also delete the Auth record, call a Cloud Function / API route from here.
   */
  const handleDeleteAccount = async (userId: string, userName: string) => {
    if (!userId) { alert('No user ID found for this post.'); return; }

    showConfirm({
      title: 'Delete Entire Account',
      message: `⚠️ This will permanently delete "${userName}"'s account and ALL their data — posts, reports, everything. They will be able to re-register with the same email if they want. This cannot be undone.`,
      confirmLabel: 'Yes, Delete Everything',
      danger: true,
      onConfirm: async () => {
        closeDialog();
        try {
          // 0. Delete the user from Firebase Authentication via our secure API route
          const authDeleteRes = await fetch('/api/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: userId }),
          });
          const authDeleteData = await authDeleteRes.json();
          if (!authDeleteRes.ok) {
            console.warn("Failed to delete Auth account:", authDeleteData.error);
            alert("Warning: Could not delete Auth record. Error: " + authDeleteData.error);
          }

          const batch = writeBatch(db);

          // 1. Delete user doc
          batch.delete(doc(db, 'users', userId));

          // 2. Delete all their posts (discussions)
          const postsSnap = await getDocs(
            query(collection(db, 'discussions'), where('authorId', '==', userId))
          );
          postsSnap.docs.forEach(d => batch.delete(d.ref));

          // 3. Delete all reports authored by them or about their posts
          const reportsByAuthorSnap = await getDocs(
            query(collection(db, 'reported_posts'), where('postAuthorId', '==', userId))
          );
          reportsByAuthorSnap.docs.forEach(d => batch.delete(d.ref));

          const reportsByUserSnap = await getDocs(
            query(collection(db, 'reported_posts'), where('reportedByUserId', '==', userId))
          );
          reportsByUserSnap.docs.forEach(d => batch.delete(d.ref));

          await batch.commit();

          alert(`Account and all data for "${userName}" has been deleted.`);
          fetchData();
        } catch (err) {
          console.error(err);
          alert('Failed to delete account. Check console for details.');
        }
      },
    });
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const pendingReports = reports;
  const filteredPosts = posts.filter(p =>
    (p.authorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.content || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ProtectedRoute>
      <ConfirmDialog
        {...dialog}
        onCancel={closeDialog}
      />

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF4D6D, #FF8C42)' }}>
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Feed & Reports</h1>
              <p className="text-sm text-slate-500">Manage community posts and reports</p>
            </div>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'posts' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'}`}>
              All Posts ({posts.length})
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'reports' ? 'bg-white shadow-sm text-red-600' : 'text-slate-600 hover:bg-slate-200/50'}`}>
              Pending Reports ({pendingReports.length})
            </button>
          </div>
        </div>

        {activeTab === 'posts' && (
          <div className="mb-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search posts by author name or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm shadow-sm"
            />
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#FF4D6D' }} />
            </div>
          ) : activeTab === 'reports' ? (
            // ── REPORTS TAB ──────────────────────────────────────────────────
            pendingReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900">All clear! 🎉</h3>
                <p className="text-slate-500 mt-1">No pending reports to review.</p>
              </div>
            ) : (
              pendingReports.map((reportGroup) => (
                <div key={reportGroup.postId} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                          Reported {reportGroup.reporters.length} times
                        </span>
                        <span className="text-sm text-slate-500">
                          Poster: <span className="font-medium text-slate-700">
                            {reportGroup.postAuthor.name || 'Unknown'} ({reportGroup.postAuthor.email || 'No email'})
                          </span>
                        </span>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4 text-slate-700 text-sm border border-slate-100 mb-4">
                        {reportGroup.postContent || 'No text content'}
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Reporters ({reportGroup.reporters.length})
                        </h4>
                        {reportGroup.reporters.map((reporter: any, idx: number) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm p-2 bg-slate-50 rounded-lg">
                            <span className="font-medium text-slate-700">{reporter.name}</span>
                            <span className="text-slate-500 text-xs">{reporter.email}</span>
                            <span className="text-slate-400 hidden sm:inline">•</span>
                            <span className="text-amber-600 italic">"{reporter.reason}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-4 ml-14">
                    <button onClick={() => handleDeletePost(reportGroup.postId, reportGroup.reportIds)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md" style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                      <Trash2 className="w-4 h-4 inline mr-2" />Delete Post
                    </button>
                    <button onClick={() => handleBanUser(reportGroup.postAuthorId, reportGroup.postAuthor.name || 'User')}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md bg-amber-500 hover:bg-amber-600">
                      <Ban className="w-4 h-4 inline mr-2" />Ban User
                    </button>
                    <button onClick={() => handleDeleteAccount(reportGroup.postAuthorId, reportGroup.postAuthor.name || 'User')}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md" style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                      <UserX className="w-4 h-4 inline mr-2" />Delete Account
                    </button>
                    <button onClick={() => handleDismissAll(reportGroup.reportIds)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-colors">
                      Dismiss All
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            // ── ALL POSTS TAB ────────────────────────────────────────────────
            filteredPosts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900">No posts found</h3>
                <p className="text-slate-500 mt-1">Try a different search query.</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div key={post.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {post.authorAvatar ? (
                        <img src={post.authorAvatar} alt="author" className="h-10 w-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-blue-700 font-bold text-sm">{post.authorName?.[0] || '?'}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{post.authorName || 'Anonymous'}</h3>
                          <span className="text-xs text-slate-500">• {post.authorCollege || 'CampusEra'}</span>
                        </div>
                        <p className="text-slate-700 mt-2 text-sm whitespace-pre-wrap">{post.content}</p>

                        {post.imageUrls && post.imageUrls.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                            {post.imageUrls.map((url: string, idx: number) => (
                              <img key={idx} src={url} alt="Post attachment" className="h-24 w-24 object-cover rounded-lg border border-slate-200 shrink-0" />
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-4 text-xs font-medium text-slate-500">
                          <span>❤️ {post.likesCount || 0}</span>
                          <span>💬 {post.commentsCount || 0}</span>
                          <span>👁️ {post.viewsCount || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons for each post */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => handleDeletePost(post.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete Post">
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleBanUser(post.authorId, post.authorName || 'User')}
                        className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Ban User">
                        <Ban className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDeleteAccount(post.authorId, post.authorName || 'User')}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Delete Account & All Data">
                        <UserX className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}