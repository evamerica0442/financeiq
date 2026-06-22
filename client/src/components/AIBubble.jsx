import React from 'react';

export default function AIBubble({ title, body, type = 'info', onDismiss }) {
  const typeStyles = {
    ok: 'bg-green-50 border-green-200 text-green-800',
    warn: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const typeIcons = {
    ok: '✅',
    warn: '⚠️',
    danger: '🚨',
    info: '💡',
  };

  return (
    <div className={`rounded-xl border p-4 ${typeStyles[type] || typeStyles.info} relative`}>
      <div className="flex items-start space-x-3">
        <span className="text-lg mt-0.5">{typeIcons[type] || typeIcons.info}</span>
        <div className="flex-1">
          {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
          <p className="text-sm opacity-90">{body}</p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-current opacity-50 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}