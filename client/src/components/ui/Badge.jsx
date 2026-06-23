import React from 'react';

export default function Badge({ children, variant = 'default', size = 'sm', className = '', dot = false }) {
  const variants = {
    ok: 'bg-[var(--accent-green)]/10 text-[var(--accent-green)] border border-[var(--accent-green)]/20',
    warn: 'bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] border border-[var(--accent-amber)]/20',
    danger: 'bg-[var(--accent-red)]/10 text-[var(--accent-red)] border border-[var(--accent-red)]/20',
    info: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20',
    purple: 'bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] border border-[var(--accent-purple)]/20',
    default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)]',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
        ${variants[variant] || variants.default}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            variant === 'ok' ? 'bg-[var(--accent-green)]' :
            variant === 'warn' ? 'bg-[var(--accent-amber)]' :
            variant === 'danger' ? 'bg-[var(--accent-red)]' :
            variant === 'info' ? 'bg-[var(--accent-blue)]' :
            variant === 'purple' ? 'bg-[var(--accent-purple)]' :
            'bg-[var(--text-secondary)]'
          }`}
        />
      )}
      {children}
    </span>
  );
}