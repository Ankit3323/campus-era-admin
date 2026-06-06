"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Trash2, SearchCode } from 'lucide-react';

interface LostFoundItem {
  id: string;
  title: string;
  description: string;
  type: string;
  location: string;
  reporterName: string;
  images: string[];
  createdAt: any;
  status: string;
}

export default function LostFoundPage() {
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'lostItems'));
      let itemsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as LostFoundItem));
      itemsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(itemsData);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item permanently?')) return;
    try {
      await deleteDoc(doc(db, 'lostItems', id));
      fetchItems();
    } catch { alert('Failed to delete'); }
  };

  const filteredItems = items.filter(item => 
    (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.reporterName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.type || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <SearchCode className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold text-slate-900">Manage Lost & Found</h1>
          </div>
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Search items, reporters, types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-10 text-center">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-500">No items found.</div>
          ) : filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="h-48 bg-slate-100 flex items-center justify-center">
                {item.images && item.images.length > 0 ? (
                  <img src={item.images[0]} alt="item" className="w-full h-full object-cover" />
                ) : (
                  <SearchCode className="w-12 h-12 text-slate-300" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.type === 'lost' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {item.type?.toUpperCase()}
                  </span>
                  <h3 className="font-bold text-slate-900 line-clamp-1 flex-1">{item.title}</h3>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2 mb-3">{item.description}</p>
                <div className="text-xs text-slate-500 mb-4">
                  By {item.reporterName} • At: {item.location}
                </div>
                <button onClick={() => handleDelete(item.id)}
                  className="w-full py-2 flex items-center justify-center gap-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium text-sm border border-slate-200 hover:border-red-200">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
