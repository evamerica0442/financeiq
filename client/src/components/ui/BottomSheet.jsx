import React, { useEffect, useRef } from 'react';

export default function BottomSheet({ isOpen, onClose, title, children, className = '' }) {
  const sheetRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{
          animation: 'fadeIn 200ms ease-out',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`
          relative w-full max-w-lg bg-[var(--bg-secondary)] rounded-t-3xl sm:rounded-2xl
          border border-[var(--border)] shadow-[var(--shadow-elevated)]
          max-h-[90vh] overflow-y-auto
          ${className}
        `}
        style={{
          animation: 'slideUp 350ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-6 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}