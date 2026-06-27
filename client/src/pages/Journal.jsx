import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import Button from '../components/ui/Button';
import { useToast } from '../hooks/useToast';

// ─── Inspirational quotes ────────────────────────────────────────────────────
const QUOTES = [
  { text: "Do not save what is left after spending, but spend what is left after saving.", author: "Warren Buffett" },
  { text: "A budget is telling your money where to go instead of wondering where it went.", author: "Dave Ramsey" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Financial freedom is available to those who learn about it and work for it.", author: "Robert Kiyosaki" },
  { text: "It's not how much money you make, but how much money you keep.", author: "Robert Kiyosaki" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Wealth is not about having a lot of money; it's about having a lot of options.", author: "Chris Rock" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Small steps in the right direction can turn out to be the biggest step of your life.", author: "Unknown" },
  { text: "Every rand you save today is working for your future self.", author: "Unknown" },
  { text: "Compound interest is the eighth wonder of the world.", author: "Albert Einstein" },
  { text: "You must gain control over your money or the lack of it will forever control you.", author: "Dave Ramsey" },
  { text: "The habit of saving is itself an education; it fosters every virtue, teaches self-denial, cultivates the sense of order.", author: "T.T. Munger" },
  { text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", author: "Ralph Waldo Emerson" },
  { text: "Success is not final; failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Beware of little expenses; a small leak will sink a great ship.", author: "Benjamin Franklin" },
  { text: "The goal isn't more money. The goal is living life on your own terms.", author: "Chris Brogan" },
  { text: "Price is what you pay. Value is what you get.", author: "Warren Buffett" },
  { text: "Formal education will make you a living; self-education will make you a fortune.", author: "Jim Rohn" },
  { text: "Know what you own, and know why you own it.", author: "Peter Lynch" },
];

// ─── Journal prompts ─────────────────────────────────────────────────────────
const PROMPTS = [
  { category: "Reflection", emoji: "🔍", text: "What was my biggest financial decision this month, and how do I feel about it?" },
  { category: "Reflection", emoji: "🔍", text: "Where did my money actually go this month vs where I planned it to go?" },
  { category: "Reflection", emoji: "🔍", text: "What money habit am I most proud of right now? What habit do I want to break?" },
  { category: "Goals", emoji: "🎯", text: "What would financial freedom look like for me in 5 years? What's one step I can take today?" },
  { category: "Goals", emoji: "🎯", text: "If I saved an extra R500 this month, what would I put it toward and why?" },
  { category: "Goals", emoji: "🎯", text: "Am I on track with my savings goals? What's holding me back if not?" },
  { category: "Mindset", emoji: "💭", text: "What emotions came up for me around money this week — stress, excitement, guilt, pride?" },
  { category: "Mindset", emoji: "💭", text: "What beliefs about money did I grow up with? Which ones are helping me, and which are holding me back?" },
  { category: "Mindset", emoji: "💭", text: "When I spend impulsively, what am I usually feeling in that moment?" },
  { category: "Planning", emoji: "📋", text: "What is one financial risk in my life right now, and what's my plan to address it?" },
  { category: "Planning", emoji: "📋", text: "What would I do differently if my income doubled tomorrow? What does that tell me about my priorities?" },
  { category: "Planning", emoji: "📋", text: "What big expenses are coming up in the next 3 months that I should start preparing for?" },
  { category: "Gratitude", emoji: "🙏", text: "What financial wins, big or small, can I celebrate right now?" },
  { category: "Gratitude", emoji: "🙏", text: "What resources or opportunities do I have access to that I sometimes take for granted?" },
  { category: "Debt", emoji: "⛓️", text: "How does my debt make me feel? What's my plan for tackling it, and how will I feel when it's gone?" },
  { category: "Debt", emoji: "⛓️", text: "Which debt would I pay off first if I had extra money, and why that one?" },
];

const CATEGORIES = [...new Set(PROMPTS.map(p => p.category))];

const MOODS = {
  great:   { emoji: '😊', label: 'Great' },
  good:    { emoji: '🙂', label: 'Good' },
  neutral: { emoji: '😐', label: 'Neutral' },
  stressed:{ emoji: '😟', label: 'Stressed' },
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

function getMoodEmoji(mood) { return MOODS[mood]?.emoji || ''; }

// ─── Quote widget ─────────────────────────────────────────────────────────────
function QuoteWidget() {
  // Rotate daily by default, allow manual shuffle
  const [idx, setIdx] = useState(() => new Date().getDate() % QUOTES.length);
  const [animating, setAnimating] = useState(false);

  function shuffle() {
    setAnimating(true);
    setTimeout(() => {
      setIdx(i => (i + 1) % QUOTES.length);
      setAnimating(false);
    }, 200);
  }

  const quote = QUOTES[idx];

  return (
    <div
      className="rounded-2xl p-5 mb-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(155,127,255,0.10) 0%, rgba(77,159,255,0.06) 100%)',
        border: '1px solid rgba(155,127,255,0.18)',
        boxShadow: '0 0 24px rgba(155,127,255,0.07)',
      }}
    >
      {/* Decorative quote mark */}
      <div
        className="absolute top-3 right-5 text-7xl font-serif leading-none pointer-events-none select-none"
        style={{ color: 'rgba(155,127,255,0.12)', fontFamily: 'Georgia, serif' }}
      >
        "
      </div>

      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: 'rgba(155,127,255,0.15)' }}
        >
          <svg className="w-4 h-4" style={{ color: 'var(--accent-purple)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium leading-relaxed mb-1.5 transition-opacity duration-200"
            style={{
              color: 'var(--text-primary)',
              fontStyle: 'italic',
              opacity: animating ? 0 : 1,
            }}
          >
            "{quote.text}"
          </p>
          <p
            className="text-xs font-semibold transition-opacity duration-200"
            style={{ color: 'var(--accent-purple)', opacity: animating ? 0 : 1 }}
          >
            — {quote.author}
          </p>
        </div>
        <button
          onClick={shuffle}
          className="p-1.5 rounded-lg flex-shrink-0 transition-all duration-200 hover:rotate-180"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-purple)'; e.currentTarget.style.backgroundColor = 'rgba(155,127,255,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          title="Next quote"
          aria-label="Next quote"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Prompts panel ────────────────────────────────────────────────────────────
function PromptsPanel({ onSelect, compact = false }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const filtered = activeCategory === 'All'
    ? PROMPTS
    : PROMPTS.filter(p => p.category === activeCategory);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ backgroundColor: 'rgba(0,212,154,0.12)' }}
        >
          ✍️
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Journal Prompts
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Click any prompt to start writing
          </p>
        </div>
      </div>

      {/* Category pills */}
      <div
        className="flex gap-1.5 px-4 py-3 overflow-x-auto scrollbar-none"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0"
            style={{
              backgroundColor: activeCategory === cat ? 'var(--accent-green)' : 'var(--bg-tertiary)',
              color: activeCategory === cat ? '#0B0D12' : 'var(--text-secondary)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Prompt list */}
      <div className={`divide-y ${compact ? 'max-h-64 overflow-y-auto scrollbar-none' : ''}`} style={{ borderColor: 'var(--border)' }}>
        {filtered.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelect(prompt)}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            className="w-full text-left flex items-start gap-3 px-5 py-3.5 transition-colors duration-150"
            style={{
              backgroundColor: hoveredIdx === i ? 'var(--bg-tertiary)' : 'transparent',
            }}
          >
            <span className="text-base flex-shrink-0 mt-0.5">{prompt.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--accent-green)' }}>
                {prompt.category}
              </p>
              <p className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
                {prompt.text}
              </p>
            </div>
            <svg
              className="w-4 h-4 flex-shrink-0 mt-1 transition-transform duration-150"
              style={{
                color: 'var(--text-muted)',
                transform: hoveredIdx === i ? 'translateX(2px)' : 'none',
              }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
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
  const [showPromptsInEditor, setShowPromptsInEditor] = useState(false);
  const offsetRef = useRef(0);
  const textareaEl = useRef(null);

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
    } catch {
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
    setShowPromptsInEditor(false);
    const entry = entries.find(e => e.id === id);
    if (entry) setFormData({ title: entry.title, content: entry.content, mood: entry.mood, tags: entry.tags || [] });
  }

  function startNewEntry(prefillTitle = '') {
    setSelectedId(null);
    setIsEditing(true);
    setCreating(true);
    setFormData({ title: prefillTitle, content: '', mood: null, tags: [] });
    setShowMobileList(false);
    setConfirmDelete(null);
    setShowPromptsInEditor(false);
  }

  // Called when user clicks a prompt — starts a new entry pre-filled with the prompt as title
  function handlePromptSelect(prompt) {
    startNewEntry(prompt.text);
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

  // Auto-save when editing existing entry
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
      setShowMobileList(true);
      addToast('Entry deleted', 'info');
    } catch {
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
          e.id === selectedId
            ? { ...e, ai_insight: res.data.insight, ai_insight_generated_at: new Date().toISOString() }
            : e
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

  const textareaRef = useCallback((el) => {
    textareaEl.current = el;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, []);

  function handleContentChange(e) {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    setFormData(p => ({ ...p, content: e.target.value }));
  }

  const selectedEntry = entries.find(e => e.id === selectedId);
  const textareaPlaceholder = 'Write your thoughts, plans, worries or wins here...\nWhat are you working toward? What has been on your mind financially?';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 backdrop-blur-sm"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(19,22,31,0.85)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Journal</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Your financial thoughts &amp; plans</p>
            </div>
            <Button onClick={() => startNewEntry()}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Entry
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search entries..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none transition-colors"
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <select value={moodFilter} onChange={e => setMoodFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="">All moods</option>
              {Object.entries(MOODS).map(([key, m]) => (
                <option key={key} value={key}>{m.emoji} {m.label}</option>
              ))}
            </select>
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="">All tags</option>
              {['savings', 'debt', 'goals', 'spending', 'income', 'investment', 'stress', 'win'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Quote widget ───────────────────────────────────────────────── */}
        <QuoteWidget />

        {/* ── AI Summary ─────────────────────────────────────────────────── */}
        {summary && (
          <div className="mb-4 rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            <button onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="w-full flex items-center justify-between px-5 py-3 text-left transition-colors"
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>📊 Journal Summary</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{summaryExpanded ? 'Collapse ▲' : 'Expand ▼'}</span>
            </button>
            {summaryExpanded && (
              <div className="px-5 pb-4">
                <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{summary.summary}</p>
                {summary.themes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {summary.themes.map(t => (
                      <span key={t} className="rounded-full text-[11px] px-2 py-0.5"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Entries this month: {summary.entryCount || total}</div>
              </div>
            )}
          </div>
        )}

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="flex gap-6">

          {/* Entry list */}
          <div
            className={'w-full lg:w-[35%] ' + ((!showMobileList && (selectedId || creating)) ? 'hidden lg:block' : '')}
            onScroll={handleScroll}
            style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', overscrollBehavior: 'contain' }}
          >
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl skeleton" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-4xl mb-3">📓</div>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Your journal is empty</h3>
                <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                  Writing about your money helps you think clearly and stay on track.
                </p>
                <Button onClick={() => startNewEntry()}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Write your first entry
                </Button>
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {entries.map(entry => (
                  <div key={entry.id} onClick={() => selectEntry(entry.id)}
                    className="p-4 rounded-xl border cursor-pointer transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: selectedId === entry.id ? 'var(--accent-purple)' : 'var(--border)',
                      borderLeft: selectedId === entry.id ? '3px solid var(--accent-purple)' : undefined,
                    }}
                    onMouseEnter={e => { if (selectedId !== entry.id) e.currentTarget.style.borderColor = 'rgba(155,127,255,0.3)'; }}
                    onMouseLeave={e => { if (selectedId !== entry.id) e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {entry.title || entry.content.substring(0, 40) + (entry.content.length > 40 ? '...' : '')}
                        </h4>
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                          {entry.content.substring(0, 80)}{entry.content.length > 80 ? '...' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {entry.ai_insight && (
                          <svg className="w-3.5 h-3.5" style={{ color: 'var(--accent-purple)' }} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(entry.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {entry.mood && <span className="text-sm">{getMoodEmoji(entry.mood)}</span>}
                      <div className="flex flex-wrap gap-1">
                        {(entry.tags || []).slice(0, 3).map(t => (
                          <span key={t} className="rounded-full text-[11px] px-2 py-0.5"
                            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                            {t}
                          </span>
                        ))}
                        {(entry.tags || []).length > 3 && (
                          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>+{entry.tags.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {loadingMore && <div className="text-center py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading more...</div>}
              </div>
            )}
          </div>

          {/* Editor / Detail panel */}
          <div className={'flex-1 lg:w-[65%] ' + ((showMobileList && !selectedEntry && !creating) ? 'hidden lg:block' : '')}>
            <button onClick={() => { setShowMobileList(true); setSelectedId(null); setCreating(false); }}
              className="lg:hidden flex items-center gap-1 text-sm mb-3 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            {creating || isEditing ? (
              <div className="space-y-4">
                {/* Title */}
                <input type="text" placeholder="What's on your mind?"
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-transparent border-none outline-none font-bold placeholder-opacity-40"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-journal)', fontSize: '20px', lineHeight: '1.8' }}
                />

                {/* Mood selector */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(MOODS).map(([key, m]) => (
                    <button key={key}
                      onClick={() => setFormData(p => ({ ...p, mood: p.mood === key ? null : key }))}
                      className="rounded-full px-3 py-1.5 text-sm transition-all"
                      style={{
                        backgroundColor: formData.mood === key ? 'rgba(155,127,255,0.15)' : 'var(--bg-tertiary)',
                        color: formData.mood === key ? 'var(--accent-purple)' : 'var(--text-secondary)',
                        border: formData.mood === key ? '1px solid rgba(155,127,255,0.3)' : '1px solid transparent',
                      }}
                    >
                      {m.emoji} {m.label}
                    </button>
                  ))}
                </div>

                {/* Prompts toggle inside editor */}
                <div>
                  <button
                    onClick={() => setShowPromptsInEditor(p => !p)}
                    className="flex items-center gap-2 text-xs font-medium mb-2 transition-colors"
                    style={{ color: showPromptsInEditor ? 'var(--accent-green)' : 'var(--text-muted)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPromptsInEditor ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'} />
                    </svg>
                    {showPromptsInEditor ? 'Hide prompts' : '✍️ Need inspiration? Browse prompts'}
                  </button>
                  {showPromptsInEditor && (
                    <div className="mb-3 animate-on-mount">
                      <PromptsPanel compact onSelect={p => {
                        setFormData(prev => ({ ...prev, title: p.text }));
                        setShowPromptsInEditor(false);
                        if (textareaEl.current) textareaEl.current.focus();
                      }} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="relative">
                  <textarea ref={textareaRef} placeholder={textareaPlaceholder}
                    value={formData.content} onChange={handleContentChange}
                    className="w-full bg-transparent border-none outline-none resize-none"
                    style={{ minHeight: '280px', color: 'var(--text-primary)', fontFamily: 'var(--font-journal)', fontSize: '19px', lineHeight: '1.9' }}
                    maxLength={5000}
                  />
                  <div className="text-right text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {formData.content.length.toLocaleString()} / 5,000
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {formData.tags.map(t => (
                      <span key={t} className="rounded-full text-[11px] px-2 py-0.5 flex items-center gap-1"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {t}
                        <button onClick={() => setFormData(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))}
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >&times;</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="+ Add tag" value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      className="flex-1 bg-transparent border-none outline-none text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    />
                    {tagInput && (
                      <button onClick={addTag} className="text-xs font-medium" style={{ color: 'var(--accent-purple)' }}>Add</button>
                    )}
                  </div>
                </div>

                {/* Save bar */}
                <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--accent-green)', opacity: savedStatus ? 1 : 0 }}>{savedStatus}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => { setCreating(false); setIsEditing(false); setShowMobileList(true); }}>Cancel</Button>
                    <Button onClick={handleSave} loading={saving}>{creating ? 'Save entry' : 'Save'}</Button>
                  </div>
                </div>
              </div>

            ) : selectedEntry ? (
              /* ── Entry detail ──────────────────────────────────────────── */
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{selectedEntry.title || 'Untitled'}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDate(selectedEntry.created_at)}</span>
                      {selectedEntry.mood && <span className="text-lg">{getMoodEmoji(selectedEntry.mood)}</span>}
                    </div>
                    {(selectedEntry.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedEntry.tags.map(t => (
                          <span key={t} className="rounded-full text-[11px] px-2 py-0.5"
                            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(true); setCreating(false); }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(selectedEntry.id)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </Button>
                  </div>
                </div>

                {confirmDelete === selectedEntry.id && (
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,91,107,0.05)', border: '1px solid rgba(255,91,107,0.2)' }}>
                    <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(selectedEntry.id)}>Delete</Button>
                    </div>
                  </div>
                )}

                <div className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-journal)', fontSize: '19px', lineHeight: '1.9' }}>
                  {selectedEntry.content}
                </div>

                {/* AI Insight */}
                <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent-purple)', boxShadow: '0 0 16px rgba(155,127,255,0.08)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: 'var(--accent-purple)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-sm font-semibold" style={{ color: 'var(--accent-purple)' }}>AI Insight</span>
                    </div>
                    <button onClick={() => generateInsight(true)} disabled={insightLoading}
                      className="text-xs transition-colors disabled:opacity-40"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-purple)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      Refresh
                    </button>
                  </div>
                  {selectedEntry.ai_insight ? (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{selectedEntry.ai_insight}</p>
                  ) : insightLoading ? (
                    <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      FinanceIQ is reading your entry <span className="animate-pulse">...</span>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => generateInsight()}>✨ Get AI insight</Button>
                  )}
                </div>
              </div>

            ) : (
              /* ── Empty state — show prompts on desktop ─────────────────── */
              <div className="hidden lg:block">
                <div className="text-center mb-6 py-8">
                  <div className="text-5xl mb-3">✍️</div>
                  <p className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>What's on your mind?</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Select an entry or pick a prompt below to start writing</p>
                </div>
                <PromptsPanel onSelect={handlePromptSelect} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
