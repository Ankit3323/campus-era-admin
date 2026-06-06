"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle, Shield, MessageSquare, Search } from 'lucide-react';

export default function FeedPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'reports'>('posts');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsSnap, postsSnap] = await Promise.all([
        getDocs(collection(db, 'reported_posts')),
        getDocs(collection(db, 'discussions'))
      ]);
      
      setReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      let postsData = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      postsData.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setPosts(postsData);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDismiss = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reported_posts', reportId), { status: 'dismissed' });
      fetchData();
    } catch { alert('Failed to dismiss'); }
  };

  const handleDeletePost = async (postId: string, reportId?: string) => {
    if (!confirm('Delete this post permanently?')) return;
    try {
      await deleteDoc(doc(db, 'discussions', postId));
      if (reportId) {
        await updateDoc(doc(db, 'reported_posts', reportId), { status: 'deleted_post' });
      }
      fetchData();
    } catch { alert('Failed to delete'); }
  };

  const pendingReports = reports.filter(r => r.status === 'pending');
  const filteredPosts = posts.filter(p => 
    (p.authorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.content || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute>
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
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'posts' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'}`}
            >
              All Posts ({posts.length})
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'reports' ? 'bg-white shadow-sm text-red-600' : 'text-slate-600 hover:bg-slate-200/50'}`}
            >
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
            <div className="text-center py-10"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#FF4D6D' }} /></div>
          ) : activeTab === 'reports' ? (
            // REPORTS TAB
            pendingReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900">All clear! 🎉</h3>
                <p className="text-slate-500 mt-1">No pending reports to review.</p>
              </div>
            ) : (
              pendingReports.map((report) => (
                <div key={report.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">Reported</span>
                        <span className="text-sm text-slate-500">Reason: <span className="font-medium text-slate-700">{report.reason}</span></span>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4 text-slate-700 text-sm border border-slate-100">
                        {report.postContent || 'No text content'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 ml-14">
                    <button onClick={() => handleDeletePost(report.postId, report.id)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md" style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                      <Trash2 className="w-4 h-4 inline mr-2" />Delete Post
                    </button>
                    <button onClick={() => handleDismiss(report.id)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-colors">
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            // ALL POSTS TAB
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
                    <button onClick={() => handleDeletePost(post.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0" title="Delete Post">
                      <Trash2 className="w-5 h-5" />
                    </button>
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
