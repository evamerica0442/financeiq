import React from 'react';

const formatCurrency = (amount) =>
  'R' + Math.abs(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function TransactionRow({ transaction, onEdit, onDelete }) {
  const isIncome = transaction.amount > 0;
  const absAmount = Math.abs(transaction.amount);

  return (
    <div
      className="flex items-center gap-3 py-3 px-4 rounded-xl transition-colors duration-150 group"
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {/* Category icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
        style={{
          backgroundColor: isIncome
            ? 'rgba(0,212,154,0.12)'
            : 'rgba(139,146,165,0.12)',
        }}
      >
        {isIncome ? '💰' : '💳'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {transaction.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            {transaction.category}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDate(transaction.date)}
          </span>
        </div>
      </div>

      {/* Amount + actions */}
      <div className="flex items-center gap-2">
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: isIncome ? 'var(--accent-green)' : 'var(--text-primary)' }}
        >
          {isIncome ? '+' : '-'}{formatCurrency(absAmount)}
        </span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => onEdit(transaction)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.backgroundColor = 'rgba(77,159,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(transaction.id)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.backgroundColor = 'rgba(255,91,107,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
