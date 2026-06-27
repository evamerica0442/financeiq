import React from 'react';

const TYPE_CONFIG = {
  ok:     { bg: 'rgba(0,212,154,0.08)',   border: 'rgba(0,212,154,0.2)',   text: 'var(--accent-green)',  icon: '✅' },
  warn:   { bg: 'rgba(255,186,59,0.08)',  border: 'rgba(255,186,59,0.2)',  text: 'var(--accent-amber)',  icon: '⚠️' },
  danger: { bg: 'rgba(255,91,107,0.08)', border: 'rgba(255,91,107,0.2)', text: 'var(--accent-red)',    icon: '🚨' },
  info:   { bg: 'rgba(77,159,255,0.08)', border: 'rgba(77,159,255,0.2)', text: 'var(--accent-blue)',   icon: '💡' },
};

export default function AIBubble({ title, body, type = 'info', onDismiss }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;

  return (
    <div
      className="rounded-xl p-4 relative"
      style={{
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5 flex-shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-sm font-semibold mb-0.5" style={{ color: cfg.text }}>
              {title}
            </h4>
          )}
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {body}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
