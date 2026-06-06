"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Trash2, ShoppingBag } from 'lucide-react';

interface MarketItem {
  id: string;
  title: string;
  price: number;
  condition: string;
  sellerName: string;
  category: string;
  allImages: string[];
  createdAt: any;
}

export default function MarketPage() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'marketItems'));
      let itemsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketItem));
      itemsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(itemsData);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this market listing permanently?')) return;
    try {
      await deleteDoc(doc(db, 'marketItems', id));
      fetchItems();
    } catch { alert('Failed to delete'); }
  };

  const filteredItems = items.filter(item => 
    (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.sellerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-slate-900">Manage Market</h1>
          </div>
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Search items, sellers, categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-10 text-center">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-500">No market items found.</div>
          ) : filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="h-48 bg-slate-100 flex items-center justify-center">
                {item.allImages && item.allImages.length > 0 ? (
                  <img src={item.allImages[0]} alt="item" className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="w-12 h-12 text-slate-300" />
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900 line-clamp-1 flex-1">{item.title}</h3>
                  <span className="font-bold text-orange-600 ml-2">₹{item.price}</span>
                </div>
                <div className="text-xs text-slate-500 mb-4">
                  By {item.sellerName} • {item.condition} • {item.category}
                </div>
                <button onClick={() => handleDelete(item.id)}
                  className="w-full py-2 flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium text-sm">
                  <Trash2 className="w-4 h-4" /> Delete Listing
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
