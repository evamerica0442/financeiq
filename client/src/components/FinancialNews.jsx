import React, { useState, useEffect, useCallback } from 'react';

// All feeds verified working with rss2json free tier (no API key, no count param)
const FEEDS = [
  {
    label: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/rss/topstories',
    color: '#4D9FFF',
    emoji: '💹',
  },
  {
    label: 'CNBC',
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    color: '#00D49A',
    emoji: '📊',
  },
  {
    label: 'BBC Business',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    color: '#FF5B6B',
    emoji: '🌍',
  },
  {
    label: 'Economist',
    url: 'https://www.economist.com/finance-and-economics/rss.xml',
    color: '#9B7FFF',
    emoji: '📰',
  },
];

// Free tier — no count param (returns up to 10 items)
const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

// Extract thumbnail — yahoo puts it in enclosure.link, others in thumbnail
function getThumbnail(item) {
  if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
  if (item.enclosure?.link && item.enclosure.link.startsWith('http')) return item.enclosure.link;
  return null;
}

const PLACEHOLDERS = ['📈', '💹', '📊', '🏦', '💰', '📉', '🌐', '💼'];

export default function FinancialNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFeed, setActiveFeed] = useState(0);
  const [error, setError] = useState(false);

  const fetchFeed = useCallback(async (idx) => {
    setLoading(true);
    setError(false);
    setArticles([]);
    const feed = FEEDS[idx];
    try {
      const url = `${RSS2JSON_BASE}${encodeURIComponent(feed.url)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
        setArticles(
          data.items.map(item => ({
            title: stripHtml(item.title) || 'Untitled',
            link: item.link || '#',
            pubDate: item.pubDate,
            description: stripHtml(item.description || item.content || '').slice(0, 130),
            thumbnail: getThumbnail(item),
          }))
        );
      } else {
        setError(true);
      }
    } catch (err) {
      console.warn('News feed fetch failed:', err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and whenever the tab changes
  useEffect(() => {
    fetchFeed(activeFeed);
  }, [activeFeed, fetchFeed]);

  const activeFeedObj = FEEDS[activeFeed];

  return (
    <div
      className="rounded-2xl overflow-hidden animate-on-mount"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-wrap gap-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(77,159,255,0.12)' }}
          >
            <svg
              className="w-4 h-4"
              style={{ color: 'var(--accent-blue)' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Financial News
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {loading ? 'Loading…' : error ? 'Feed unavailable' : `${articles.length} stories from ${activeFeedObj.label}`}
            </p>
          </div>
        </div>

        {/* Source tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl flex-wrap"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          {FEEDS.map((feed, idx) => (
            <button
              key={feed.label}
              onClick={() => { if (idx !== activeFeed) setActiveFeed(idx); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200"
              style={{
                backgroundColor: activeFeed === idx ? `${feed.color}22` : 'transparent',
                color: activeFeed === idx ? feed.color : 'var(--text-secondary)',
                border: activeFeed === idx ? `1px solid ${feed.color}35` : '1px solid transparent',
              }}
            >
              {feed.emoji} {feed.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>

        {loading && (
          <div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  className="skeleton w-14 h-14 rounded-xl flex-shrink-0"
                  style={{ animationDelay: `${i * 70}ms` }}
                />
                <div className="flex-1 space-y-2 py-1">
                  <div
                    className="skeleton h-3.5 rounded"
                    style={{ width: `${65 + (i % 4) * 9}%`, animationDelay: `${i * 70}ms` }}
                  />
                  <div
                    className="skeleton h-3 rounded"
                    style={{ width: `${45 + (i % 3) * 10}%`, animationDelay: `${i * 70 + 40}ms` }}
                  />
                  <div
                    className="skeleton h-2.5 rounded w-14"
                    style={{ animationDelay: `${i * 70 + 80}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center py-12 px-6 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 text-2xl"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              📡
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Feed unavailable
            </p>
            <p className="text-xs mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
              Could not load {activeFeedObj.label}. Try another source or retry.
            </p>
            <button
              onClick={() => fetchFeed(activeFeed)}
              className="text-xs font-medium px-4 py-2 rounded-xl transition-all"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--accent-blue)',
                border: '1px solid var(--border)',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && articles.map((article, i) => (
          <a
            key={i}
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 p-4 transition-colors duration-150 group"
            style={{ textDecoration: 'none', display: 'flex' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {/* Thumbnail */}
            <div
              className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-xl"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              {article.thumbnail ? (
                <img
                  src={article.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerText = PLACEHOLDERS[i % PLACEHOLDERS.length];
                  }}
                />
              ) : (
                PLACEHOLDERS[i % PLACEHOLDERS.length]
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-medium leading-snug line-clamp-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {article.title}
              </p>
              {article.description && (
                <p
                  className="text-[11px] mt-1 line-clamp-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {article.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: activeFeedObj.color }}
                >
                  {activeFeedObj.emoji} {activeFeedObj.label}
                </span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {timeAgo(article.pubDate)}
                </span>
                <span
                  className="ml-auto text-[10px] flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--accent-blue)' }}
                >
                  Read
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* ── Footer ── */}
      {!loading && !error && articles.length > 0 && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {articles.length} stories
          </span>
          <button
            onClick={() => fetchFeed(activeFeed)}
            className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
