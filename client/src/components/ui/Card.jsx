import React from 'react';

export default function Card({
  children,
  className = '',
  glow = null,
  gradient = false,
  glass = false,
  padding = true,
  onClick,
  hover = false,
  ...props
}) {
  const glowStyles = {
    green: 'shadow-[var(--shadow-glow-green)] border-[var(--accent-green)]/20',
    purple: 'shadow-[var(--shadow-glow-purple)] border-[var(--accent-purple)]/20',
    blue: 'shadow-[0_0_20px_rgba(77,159,255,0.15)] border-[var(--accent-blue)]/20',
    amber: 'shadow-[0_0_20px_rgba(255,171,46,0.15)] border-[var(--accent-amber)]/20',
    red: 'shadow-[0_0_20px_rgba(255,92,92,0.15)] border-[var(--accent-red)]/20',
  };

  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)]
        ${padding ? 'p-5 sm:p-6' : ''}
        ${gradient ? 'gradient-bg border-transparent' : ''}
        ${glass ? 'glass' : ''}
        ${glow ? glowStyles[glow] || glowStyles.green : ''}
        ${hover ? 'card-lift cursor-pointer' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}