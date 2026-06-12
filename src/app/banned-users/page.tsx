"use client";

import { useState, useEffect } from 'react';
import { UserX, Search, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';

interface BannedUser {
  email: string;
  userId: string;
  username: string;
  profilePicture?: string;
  isDeleted?: boolean;
}

export default function BannedUsersPage() {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wiping, setWiping] = useState<string | null>(null);

  const fetchBannedUsers = async () => {
    setLoading(true);
    try {
      // Fetch all banned emails
      const bannedEmailsSnap = await getDocs(collection(db, 'banned_emails'));
      const emails = bannedEmailsSnap.docs.map(d => d.id);

      // We also check for users marked as blocked
      const usersSnap = await getDocs(query(collection(db, 'users'), where('blocked', '==', true)));
      
      const combinedUsers: Map<string, BannedUser> = new Map();

      // Add blocked users
      usersSnap.docs.forEach(doc => {
        const data = doc.data();
        combinedUsers.set(data.email || data.emailAddress || doc.id, {
          email: data.email || data.emailAddress || 'No Email',
          userId: doc.id,
          username: data.name || data.username || 'Unknown User',
          profilePicture: data.profilePicture
        });
      });

      // Cross reference with banned emails
      for (const email of emails) {
        if (!combinedUsers.has(email)) {
          // If the banned email isn't in our blocked users list, try to find the user by email
          const q = query(collection(db, 'users'), where('email', '==', email));
          const matchSnap = await getDocs(q);
          if (!matchSnap.empty) {
            const userDoc = matchSnap.docs[0];
            const data = userDoc.data();
            combinedUsers.set(email, {
              email: email,
              userId: userDoc.id,
              username: data.name || data.username || 'Unknown User',
              profilePicture: data.profilePicture
            });
          } else {
            // Also check 'emailAddress' field which might be used
            const q2 = query(collection(db, 'users'), where('emailAddress', '==', email));
            const matchSnap2 = await getDocs(q2);
            if (!matchSnap2.empty) {
              const userDoc = matchSnap2.docs[0];
              const data = userDoc.data();
              combinedUsers.set(email, {
                email: email,
                userId: userDoc.id,
                username: data.name || data.username || 'Unknown User',
                profilePicture: data.profilePicture
              });
            } else {
              combinedUsers.set(email, {
                email: email,
                userId: 'Not Found',
                username: 'Unknown User (Profile may be deleted)'
              });
            }
          }
        }
      }

      setBannedUsers(Array.from(combinedUsers.values()));
    } catch (error) {
      console.error('Error fetching banned users:', error);
      alert('Failed to load banned users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBannedUsers();
  }, []);

  const handleWipeData = async (userId: string, email: string) => {
    if (userId === 'Not Found') {
      alert("Cannot wipe data because the user ID was not found. Their profile might already be deleted.");
      return;
    }

    const confirmWipe = window.confirm(
      `CRITICAL WARNING:\n\nAre you absolutely sure you want to PERMANENTLY wipe all data for ${email}?\n\nThis will delete their posts, comments, likes, notifications, and profile. THIS ACTION CANNOT BE UNDONE.`
    );

    if (!confirmWipe) return;

    setWiping(userId);
    try {
      const res = await fetch('/api/users/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email })
      });

      const data = await res.json();
      
      if (res.ok) {
        if (data.commentsError) {
          const indexUrlMatch = data.commentsError.match(/(https:\/\/console\.firebase\.google\.com[^\s]+)/);
          const url = indexUrlMatch ? indexUrlMatch[0] : null;
          
          if (url) {
            alert(`Almost done! Profile, posts, and likes were successfully wiped.\n\nHOWEVER, to delete their comments, Firebase requires a database index. Please copy and paste this link in your browser to create it:\n\n${url}\n\nOnce created, wiping will be 100% complete.`);
          } else {
            alert(`Almost done! Data wiped, but comments couldn't be deleted because an index is missing. Please check your Firebase Console.`);
          }
        } else {
          alert('User data wiped completely!');
        }
        
        setBannedUsers(prev => prev.map(u => u.userId === userId ? { ...u, isDeleted: true } : u));
      } else {
        alert('Error wiping user data: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Wipe error:', error);
      alert('Failed to wipe user data. See console for details.');
    } finally {
      setWiping(null);
    }
  };

  const filteredUsers = bannedUsers.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.userId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <UserX className="w-8 h-8 text-rose-600" />
              <h1 className="text-3xl font-bold text-slate-900">Banned Users</h1>
            </div>
            <p className="text-slate-500">Manage banned accounts and permanently wipe their data.</p>
          </div>
          
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <span className="font-medium text-slate-700">
              {bannedUsers.length} Banned Accounts
            </span>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-rose-800">Danger Zone</h3>
            <p className="text-sm text-rose-600 mt-1">
              Wiping a user's data will permanently delete all their posts, comments, likes, and profile. 
              This is designed to completely scrub spammers and abusive accounts from your database.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent shadow-sm"
          />
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No banned users found matching your search.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <div key={user.email} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 transition-colors">
                    
                    <div className="flex items-center gap-4">
                      {user.profilePicture ? (
                        <img src={user.profilePicture} alt="" className="w-12 h-12 rounded-full object-cover bg-slate-200" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-lg">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                          {user.username}
                          {user.isDeleted && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Data Wiped</span>}
                        </h3>
                        <div className="text-slate-500 text-sm mt-0.5">
                          <span className="font-medium text-slate-700">{user.email}</span>
                          <span className="mx-2">•</span>
                          ID: <span className="font-mono text-xs">{user.userId}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleWipeData(user.userId, user.email)}
                      disabled={wiping === user.userId || user.isDeleted}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        user.isDeleted 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-200 hover:border-rose-600'
                      }`}
                    >
                      {wiping === user.userId ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                          <span>Wiping...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>{user.isDeleted ? 'Wiped' : 'Wipe All Data'}</span>
                        </>
                      )}
                    </button>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
