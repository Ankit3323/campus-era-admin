"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { Mail, Search, Send, Eye, Code2, Users, GraduationCap, Store, X, CheckCircle } from 'lucide-react';

interface U { id: string; name?: string; email?: string; role?: string; }

export default function EmailPage() {
  const { user, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [progress, setProgress] = useState<
    { total: number; done: number; failed: number; sent: string[] } | null
  >(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        setUsers(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((u: U) => !!u.email),
        );
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // Restore the last saved draft (subject + HTML) so you start where you left off.
  useEffect(() => {
    try {
      const h = localStorage.getItem('campusera_email_html');
      const s = localStorage.getItem('campusera_email_subject');
      if (h) setHtml(h);
      if (s) setSubject(s);
    } catch { /* ignore */ }
  }, []);

  // Auto-save the draft on every change.
  useEffect(() => {
    try {
      localStorage.setItem('campusera_email_html', html);
      localStorage.setItem('campusera_email_subject', subject);
    } catch { /* ignore */ }
  }, [html, subject]);

  const students = useMemo(() => users.filter((u) => u.role !== 'owner' && u.role !== 'admin'), [users]);
  const owners = useMemo(() => users.filter((u) => u.role === 'owner'), [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  }, [users, search]);

  const emailOf = (u: U) => (u.email || '').toLowerCase();
  const setGroup = (list: U[]) => setSelected(new Set(list.map(emailOf)));
  const toggle = (email: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      const e = email.toLowerCase();
      n.has(e) ? n.delete(e) : n.add(e);
      return n;
    });
  const addAllFiltered = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      filtered.forEach((u) => u.email && n.add(emailOf(u)));
      return n;
    });

  const send = async () => {
    if (!subject.trim() || !html.trim()) { setResult('Add a subject and an HTML body first.'); return; }
    if (selected.size === 0) { setResult('Select at least one recipient.'); return; }
    const list = [...selected];
    if (!confirm(`Send this email to ${list.length} recipient(s)?`)) return;

    setSending(true);
    setResult('');
    setProgress({ total: list.length, done: 0, failed: 0, sent: [] });

    const token = user ? await user.getIdToken() : '';
    const GAP_MS = 2000; // send one email every 2 seconds (gentle on Brevo)
    let done = 0, failed = 0;
    const sent: string[] = [];
    let lastError = '';

    for (let i = 0; i < list.length; i++) {
      const email = list[i];
      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subject, html, emails: [email] }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          done += 1;
          sent.push(email);
        } else {
          failed += 1;
          lastError = data.error || (data.errors || []).join(' | ') || `HTTP ${res.status}`;
        }
      } catch (e: any) {
        failed += 1;
        lastError = e?.message || String(e);
      }
      setProgress({ total: list.length, done, failed, sent: [...sent] });
      // 2-second gap before the next email (skip after the last one).
      if (i < list.length - 1) {
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
    }

    setSending(false);
    setResult(
      failed === 0
        ? `✅ Sent to all ${done} recipient(s).`
        : `⚠️ Sent ${done}, failed ${failed}.${lastError ? ' ' + lastError : ''}`,
    );
  };

  const nameForEmail = (email: string) =>
    users.find((u) => emailOf(u) === email)?.name || email;

  // Add arbitrary external emails (comma / space / newline separated).
  const addCustomEmails = () => {
    const found = customInput
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@') && e.includes('.'));
    if (found.length === 0) return;
    setSelected((prev) => new Set([...prev, ...found]));
    setCustomInput('');
  };

  if (!isSuperAdmin) {
    return (
      <ProtectedRoute>
        <div className="max-w-3xl mx-auto p-10 text-center text-slate-500">
          <Mail className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          Only the main admin can send emails.
        </div>
      </ProtectedRoute>
    );
  }

  const GroupBtn = ({ label, count, icon: Icon, onClick }: any) => (
    <button onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
      <Icon className="w-4 h-4 text-blue-600" />
      {label} <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{count}</span>
    </button>
  );

  return (
    <ProtectedRoute>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Send Email</h1>
            <p className="text-sm text-slate-500">From mail@campusera.in · main admin only</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Compose */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Important update from CampusEra"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-slate-700">Email body (HTML)</label>
                  <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                    <button onClick={() => setShowPreview(false)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md ${!showPreview ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                      <Code2 className="w-3.5 h-3.5" /> Code
                    </button>
                    <button onClick={() => setShowPreview(true)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md ${showPreview ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                  </div>
                </div>
                {showPreview ? (
                  <div className="border border-slate-200 rounded-xl h-[380px] overflow-auto bg-white">
                    <iframe title="preview" className="w-full h-full" srcDoc={html} />
                  </div>
                ) : (
                  <textarea value={html} onChange={(e) => setHtml(e.target.value)}
                    placeholder="Paste your HTML email design here…"
                    spellCheck={false}
                    className="w-full h-[380px] px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-mono resize-none" />
                )}
              </div>
            </div>
          </div>

          {/* Recipients */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Recipients</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{selected.size} selected</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <GroupBtn label="All Students" count={students.length} icon={GraduationCap} onClick={() => setGroup(students)} />
                <GroupBtn label="All Owners" count={owners.length} icon={Store} onClick={() => setGroup(owners)} />
                <GroupBtn label="Everyone" count={users.length} icon={Users} onClick={() => setGroup(users)} />
                {selected.size > 0 && (
                  <button onClick={() => setSelected(new Set())}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>

              {/* Custom / external emails */}
              <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Add custom / external emails
                </label>
                <div className="flex gap-2">
                  <input
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomEmails(); } }}
                    placeholder="name@example.com, another@x.com"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm" />
                  <button onClick={addCustomEmails}
                    className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900">
                    Add
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Separate multiple with commas. They join the recipient list.</p>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm" />
              </div>
              <button onClick={addAllFiltered}
                className="text-xs font-semibold text-blue-600 hover:underline mb-2">
                + Add all {search ? 'matching' : ''} ({filtered.length})
              </button>

              <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-[300px] overflow-auto">
                {loading ? (
                  <div className="p-6 text-center text-sm text-slate-400">Loading users…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">No users found.</div>
                ) : filtered.slice(0, 300).map((u) => {
                  const checked = selected.has(emailOf(u));
                  return (
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" checked={checked} onChange={() => toggle(emailOf(u))}
                        className="h-4 w-4 rounded accent-blue-600" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-800 truncate">{u.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-400 truncate">{u.email}</div>
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400">{u.role || 'student'}</span>
                    </label>
                  );
                })}
                {filtered.length > 300 && (
                  <div className="p-2 text-center text-[11px] text-slate-400">Showing first 300 — refine your search.</div>
                )}
              </div>
            </div>

            <button onClick={send} disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm">
              {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : `Send to ${selected.size} recipient${selected.size === 1 ? '' : 's'}`}
            </button>
            {result && (
              <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 whitespace-pre-wrap">{result}</div>
            )}
          </div>
        </div>
      </div>

      {/* Live sending dialog — ticks each recipient off as it's sent */}
      {progress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {sending ? 'Sending emails…' : (progress.failed === 0 ? 'All sent ✅' : 'Finished')}
              </h3>
              {!sending && (
                <button onClick={() => setProgress(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">{progress.done + progress.failed} / {progress.total}</span>
              <span className="text-xs text-slate-400">
                2s gap{progress.failed > 0 ? ' · ' : ''}
                {progress.failed > 0 && <span className="text-red-500 font-semibold">{progress.failed} failed</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-4">
              <div className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${Math.round(((progress.done + progress.failed) / progress.total) * 100)}%` }} />
            </div>

            <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-64 overflow-auto">
              {sending && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                  Sending next…
                </div>
              )}
              {progress.sent.slice().reverse().map((e) => (
                <div key={e} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-slate-800 truncate">{nameForEmail(e)}</div>
                    <div className="text-xs text-slate-400 truncate">{e}</div>
                  </div>
                </div>
              ))}
            </div>

            {!sending && (
              <button onClick={() => setProgress(null)}
                className="mt-4 w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
