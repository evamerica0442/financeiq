import React, { useState, useEffect, useCallback } from 'react';

// Public RSS feeds proxied via rss2json (no key required for basic use)
const FEEDS = [
  {
    label: 'Reuters',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    color: '#FF5B6B',
  },
  {
    label: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/rss/topstories',
    color: '#4D9FFF',
  },
  {
    label: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories',
    color: '#00D49A',
  },
];

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim() : '';
}

export default function FinancialNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFeed, setActiveFeed] = useState(0);
  const [error, setError] = useState(false);

  const fetchFeed = useCallback(async (idx) => {
    setLoading(true);
    setError(false);
    const feed = FEEDS[idx];
    try {
      const res = await fetch(
        `${RSS2JSON}${encodeURIComponent(feed.url)}&count=12`,
        { signal: AbortSignal.timeout(8000) }
      );
      const data = await res.json();
      if (data.status === 'ok' && data.items?.length) {
        setArticles(
          data.items.slice(0, 12).map(item => ({
            title: stripHtml(item.title) || '',
            link: item.link || '#',
            pubDate: item.pubDate,
            description: stripHtml(item.description || item.content || '').slice(0, 120),
            thumbnail: item.thumbnail || item.enclosure?.link || null,
          }))
        );
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeed(activeFeed); }, [activeFeed, fetchFeed]);

  return (
    <div
      className="rounded-2xl overflow-hidden animate-on-mount"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(77,159,255,0.12)' }}
          >
            <svg className="w-4 h-4" style={{ color: 'var(--accent-blue)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Financial News</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Live market updates</p>
          </div>
        </div>

        {/* Source tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          {FEEDS.map((feed, idx) => (
            <button
              key={feed.label}
              onClick={() => setActiveFeed(idx)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200"
              style={{
                backgroundColor: activeFeed === idx ? feed.color + '20' : 'transparent',
                color: activeFeed === idx ? feed.color : 'var(--text-secondary)',
                border: activeFeed === idx ? `1px solid ${feed.color}30` : '1px solid transparent',
              }}
            >
              {feed.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {loading ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 p-4">
                <div className="skeleton w-14 h-14 rounded-xl flex-shrink-0" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="flex-1 space-y-2 py-1">
                  <div className="skeleton h-3.5 rounded" style={{ width: `${70 + (i % 3) * 10}%`, animationDelay: `${i * 80}ms` }} />
                  <div className="skeleton h-3 rounded" style={{ width: `${50 + (i % 4) * 8}%`, animationDelay: `${i * 80 + 40}ms` }} />
                  <div className="skeleton h-2.5 rounded w-16" style={{ animationDelay: `${i * 80 + 80}ms` }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-12 px-6 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-xl"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              📡
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Feed unavailable</p>
            <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
              Try a different source or check your connection
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
        ) : (
          articles.map((article, i) => (
            <a
              key={i}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 p-4 transition-all duration-150 group"
              style={{ textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {/* Thumbnail or placeholder */}
              <div
                className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                {article.thumbnail ? (
                  <img
                    src={article.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">
                    {['📈', '💹', '📊', '🏦', '💰', '📉'][i % 6]}
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-medium leading-snug line-clamp-2 transition-colors duration-150"
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
                    className="text-[10px] font-medium"
                    style={{ color: FEEDS[activeFeed].color }}
                  >
                    {FEEDS[activeFeed].label}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </span>
                </div>
              </div>
            </a>
          ))
        )}
      </div>

      {/* Footer refresh */}
      {!loading && !error && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {articles.length} stories · refreshes hourly
          </span>
          <button
            onClick={() => fetchFeed(activeFeed)}
            className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
