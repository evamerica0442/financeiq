import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import Button from '../components/ui/Button';
import { useToast } from '../hooks/useToast';

const MOODS = {
  great: { emoji: '😊', label: 'Great' },
  good: { emoji: '🙂', label: 'Good' },
  neutral: { emoji: '😐', label: 'Neutral' },
  stressed: { emoji: '😟', label: 'Stressed' },
  worried: { emoji: '😰', label: 'Worried' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDate.getTime() === today.getTime()) return 'Today';
  if (dDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getMoodEmoji(mood) {
  return MOODS[mood]?.emoji || '';
}

export default function Journal() {
  const { addToast } = useToast();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const [summary, setSummary] = useState(null);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', mood: null, tags: [] });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const offsetRef = useRef(0);

  const fetchEntries = useCallback(async (reset = false) => {
    try {
      if (reset) { setLoading(true); offsetRef.current = 0; }
      const params = new URLSearchParams();
      params.set('limit', '20');
      params.set('offset', reset ? '0' : String(offsetRef.current));
      if (search) params.set('search', search);
      if (moodFilter) params.set('mood', moodFilter);
      if (tagFilter) params.set('tag', tagFilter);
      const res = await api.get('/journal?' + params.toString());
      const data = res.data;
      if (reset) setEntries(data.entries);
      else setEntries(prev => [...prev, ...data.entries]);
      setTotal(data.total);
      setHasMore(data.hasMore);
      offsetRef.current = reset ? data.entries.length : offsetRef.current + data.entries.length;
    } catch (err) {
      addToast('Failed to load journal entries', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, moodFilter, tagFilter, addToast]);

  useEffect(() => { fetchEntries(true); }, [fetchEntries]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/journal/summary/ai');
        if (res.data.summary) setSummary(res.data);
      } catch { /* graceful */ }
    })();
  }, []);

  function selectEntry(id) {
    setSelectedId(id);
    setIsEditing(false);
    setCreating(false);
    setShowMobileList(false);
    const entry = entries.find(e => e.id === id);
    if (entry) setFormData({ title: entry.title, content: entry.content, mood: entry.mood, tags: entry.tags || [] });
  }

  function startNewEntry() {
    setSelectedId(null);
    setIsEditing(true);
    setCreating(true);
    setFormData({ title: '', content: '', mood: null, tags: [] });
    setShowMobileList(false);
    setConfirmDelete(null);
  }

  async function handleSave() {
    if (!formData.content.trim()) { addToast('Content is required', 'error'); return; }
    if (formData.content.length > 5000) { addToast('Content must be 5000 characters or less', 'error'); return; }
    setSaving(true);
    try {
      if (creating) {
        const res = await api.post('/journal', formData);
        setEntries(prev => [res.data, ...prev]);
        setTotal(prev => prev + 1);
        setSelectedId(res.data.id);
        setCreating(false);
        setIsEditing(false);
        addToast('Entry created', 'success');
      } else if (selectedId) {
        const res = await api.put('/journal/' + selectedId, formData);
        setEntries(prev => prev.map(e => e.id === selectedId ? res.data : e));
        setSavedStatus('Saved');
        setTimeout(() => setSavedStatus(''), 2000);
        addToast('Entry updated', 'success');
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!selectedId || creating || !formData.content) return;
    const timer = setTimeout(async () => {
      try {
        await api.put('/journal/' + selectedId, formData);
        setSavedStatus('Saved');
        setTimeout(() => setSavedStatus(''), 2000);
      } catch { /* silent */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [formData.content, formData.title, formData.mood, formData.tags, selectedId, creating]);

  async function handleDelete(id) {
    try {
      await api.delete('/journal/' + id);
      setEntries(prev => prev.filter(e => e.id !== id));
      setTotal(prev => prev - 1);
      setSelectedId(null);
      setConfirmDelete(null);
      addToast('Entry deleted', 'info');
    } catch (err) {
      addToast('Failed to delete', 'error');
    }
  }

  function addTag() {
    const tag = tagInput.toLowerCase().trim();
    if (tag && !formData.tags.includes(tag)) setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    setTagInput('');
  }

  async function generateInsight(force = false) {
    if (!selectedId) return;
    setInsightLoading(true);
    try {
      const url = '/journal/' + selectedId + '/insight' + (force ? '?force=true' : '');
      const res = await api.post(url);
      if (res.data.insight) {
        setEntries(prev => prev.map(e =>
          e.id === selectedId ? { ...e, ai_insight: res.data.insight, ai_insight_generated_at: new Date().toISOString() } : e
        ));
      }
    } catch {
      addToast('Could not generate insight', 'error');
    } finally {
      setInsightLoading(false);
    }
  }

  function handleScroll(e) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && hasMore && !loadingMore) {
      setLoadingMore(true);
      fetchEntries(false);
    }
  }

  function autoResize(el) {
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }

  const selectedEntry = entries.find(e => e.id === selectedId);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Journal</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">Your financial thoughts & plans</p>
            </div>
            <Button onClick={startNewEntry}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              New Entry
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" placeholder="Search entries..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-purple)] transition-colors" />
            </div>
            <select value={moodFilter} onChange={e => setMoodFilter(e.target.value)} className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-purple)]">
              <option value="">All moods</option>
              {Object.entries(MOODS).map(([key, m]) => (<option key={key} value={key}>{m.emoji} {m.label}</option>))}
            </select>
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-purple)]">
              <option value="">All tags</option>
              {['savings','debt','goals','spending','income','investment','stress','win'].map(t => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
        </div>
      </div>

        {summary && (
          <div className="mb-4 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <button onClick={() => setSummaryExpanded(!summaryExpanded)} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[var(--bg-secondary)]/50 transition-colors">
              <span className="text-sm font-semibold text-[var(--text-primary)]">📊 Journal Summary</span>
              <span className="text-xs text-[var(--text-secondary)]">{summaryExpanded ? 'Collapse ▲' : 'Expand ▼'}</span>
            </button>
            {summaryExpanded && (
              <div className="px-5 pb-4">
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3 whitespace-pre-wrap">{summary.summary}</p>
                {summary.themes && summary.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {summary.themes.map(t => (<span key={t} className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full text-[11px] px-2 py-0.5 border border-[var(--border)]">{t}</span>))}
                  </div>
                )}
                <div className="text-xs text-[var(--text-secondary)]">Entries this month: {summary.entryCount || total}</div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-6">
          <div className={'w-full lg:w-[35%] ' + (!showMobileList && !selectedEntry ? 'block' : '') + (selectedEntry && !showMobileList ? ' hidden lg:block' : '')}
            onScroll={handleScroll} style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => (<div key={i} className="h-24 bg-[var(--bg-tertiary)] rounded-xl animate-pulse" />))}</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-16 px-4">
                <svg className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Your financial journal is empty</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">Writing about your money helps you think more clearly, spot patterns, and stay motivated toward your goals.</p>
                <Button onClick={startNewEntry}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Write your first entry</Button>
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {entries.map(entry => (
                  <div key={entry.id} onClick={() => selectEntry(entry.id)}
                    className={'p-4 rounded-xl border cursor-pointer transition-all duration-200 ' + (selectedId === entry.id ? 'bg-[var(--bg-secondary)] border-[var(--accent-purple)]' : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--accent-purple)]/30')}
                    style={selectedId === entry.id ? { borderLeft: '3px solid var(--accent-purple)' } : {}}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{entry.title || entry.content.substring(0, 40) + (entry.content.length > 40 ? '...' : '')}</h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{entry.content.substring(0, 80)}{entry.content.length > 80 ? '...' : ''}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {entry.ai_insight && <svg className="w-3.5 h-3.5 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>}
                        <span className="text-xs text-[var(--text-secondary)]">{formatDate(entry.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {entry.mood && <span className="text-sm" title={MOODS[entry.mood]?.label}>{getMoodEmoji(entry.mood)}</span>}
                      <div className="flex flex-wrap gap-1">
                        {(entry.tags || []).slice(0, 3).map(t => (<span key={t} className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full text-[11px] px-2 py-0.5">{t}</span>))}
                        {(entry.tags || []).length > 3 && <span className="text-[11px] text-[var(--text-secondary)]">+{entry.tags.length - 3} more</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {loadingMore && <div className="text-center py-4 text-sm text-[var(--text-secondary)]">Loading more...</div>}
              </div>
            )}
          </div>

          <div className={'flex-1 lg:w-[65%] ' + (showMobileList && !selectedEntry && !creating ? 'hidden lg:block' : '')}>
            <button onClick={() => { setShowMobileList(true); setSelectedId(null); setCreating(false); }}
              className="lg:hidden flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-3 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              Back
            </button>

            {creating || isEditing ? (
              <div className="space-y-4">
                <input type="text" placeholder="What's on your mind?" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-transparent border-none outline-none text-xl font-bold text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none" />
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(MOODS).map(([key, m]) => (
                    <button key={key} onClick={() => setFormData(p => ({ ...p, mood: p.mood === key ? null : key }))}
                      className={'rounded-full px-3 py-1.5 text-sm transition-all ' + (formData.mood === key ? 'bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] border border-[var(--accent-purple)]/30' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-transparent hover:border-[var(--border)]')}>
                      {m.emoji} {m.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <textarea ref={autoResize} placeholder={'Write your thoughts, plans, worries or wins here...\nWhat are you working toward? What has been on your mind financially?'}
                    value={formData.content} onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                    className="w-full bg-transparent border-none outline-none text-[15px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none leading-relaxed" style={{ minHeight: '300px' }} maxLength={5000} />
                  <div className="text-right text-xs text-[var(--text-secondary)] mt-1">{formData.content.length.toLocaleString()} / 5,000</div>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {formData.tags.map(t => (
                      <span key={t} className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full text-[11px] px-2 py-0.5 flex items-center gap-1">
                        {t} <button onClick={() => setFormData(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))} className="hover:text-[var(--accent-red)]">&times;</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="+ Add tag" value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]" />
                    {tagInput && <button onClick={addTag} className="text-xs text-[var(--accent-purple)] hover:underline">Add</button>}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2">{savedStatus && <span className="text-xs text-[var(--accent-green)]">{savedStatus}</span>}</div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => { setCreating(false); setIsEditing(false); setShowMobileList(true); }}>Cancel</Button>
                    <Button onClick={handleSave} loading={saving}>{creating ? 'Save entry' : 'Save'}</Button>
                  </div>
                </div>
              </div>
            ) : selectedEntry ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">{selectedEntry.title || 'Untitled'}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-[var(--text-secondary)]">{formatDate(selectedEntry.created_at)}</span>
                      {selectedEntry.mood && <span className="text-lg" title={MOODS[selectedEntry.mood]?.label}>{getMoodEmoji(selectedEntry.mood)}</span>}
                    </div>
                    {(selectedEntry.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedEntry.tags.map(t => (<span key={t} className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full text-[11px] px-2 py-0.5">{t}</span>))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(true); setCreating(false); }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(selectedEntry.id)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      Delete
                    </Button>
                  </div>
                </div>
                {confirmDelete === selectedEntry.id && (
                  <div className="p-4 bg-[var(--accent-red)]/5 border border-[var(--accent-red)]/20 rounded-xl">
                    <p className="text-sm text-[var(--text-primary)] mb-3">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(selectedEntry.id)}>Delete</Button>
                    </div>
                  </div>
                )}
                <div className="text-[15px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{selectedEntry.content}</div>
                <div className="border-l-3 border-[var(--accent-purple)] bg-[var(--bg-tertiary)] rounded-xl p-5" style={{ borderLeft: '3px solid var(--accent-purple)', boxShadow: '0 0 16px rgba(155, 127, 255, 0.1)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>
                      <span className="text-sm font-semibold text-[var(--accent-purple)]">AI Insight</span>
                    </div>
                    <button onClick={() => generateInsight(true)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-purple)] transition-colors" disabled={insightLoading}>Refresh</button>
                  </div>
                  {selectedEntry.ai_insight ? (
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">{selectedEntry.ai_insight}</p>
                  ) : insightLoading ? (
                    <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">FinanceIQ is reading your entry<span className="animate-pulse">...</span></div>
                  ) : (
                    <Button variant="purple" size="sm" onClick={() => generateInsight()}>Get AI insight</Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-[var(--text-secondary)] hidden lg:block">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <p className="text-sm">Select an entry or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
