import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) {
  const base = [
    'inline-flex items-center justify-center font-medium rounded-xl',
    'transition-all duration-200',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    'select-none btn-press',
  ].join(' ');

  const variants = {
    primary:   'bg-[var(--accent-green)]  text-[#0B0D12] hover:opacity-90 focus-visible:outline-[var(--accent-green)]',
    secondary: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] focus-visible:outline-[var(--accent-blue)]',
    ghost:     'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus-visible:outline-[var(--accent-blue)]',
    danger:    'bg-[var(--accent-red)]    text-white hover:opacity-90 focus-visible:outline-[var(--accent-red)]',
    purple:    'bg-[var(--accent-purple)] text-white hover:opacity-90 focus-visible:outline-[var(--accent-purple)]',
    google:    'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] focus-visible:outline-[var(--accent-blue)]',
  };

  const sizes = {
    xs: 'px-2.5 py-1.5 text-xs  gap-1',
    sm: 'px-3.5 py-2   text-xs  gap-1.5',
    md: 'px-5   py-2.5 text-sm  gap-2',
    lg: 'px-6   py-3   text-sm  gap-2',
    xl: 'px-8   py-4   text-base gap-2.5',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${base}
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${fullWidth ? 'w-full' : ''}
        ${(disabled || loading) ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}
