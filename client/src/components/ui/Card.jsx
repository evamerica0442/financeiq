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
  style = {},
  ...props
}) {
  const glowMap = {
    green:  { shadow: 'var(--shadow-glow-green)',  border: 'rgba(0,212,154,0.2)' },
    purple: { shadow: 'var(--shadow-glow-purple)', border: 'rgba(155,127,255,0.2)' },
    blue:   { shadow: 'var(--shadow-glow-blue)',   border: 'rgba(77,159,255,0.2)' },
    amber:  { shadow: 'var(--shadow-glow-amber)',  border: 'rgba(255,186,59,0.2)' },
    red:    { shadow: 'var(--shadow-glow-red)',    border: 'rgba(255,91,107,0.2)' },
  };

  const glowStyle = glow && glowMap[glow]
    ? { boxShadow: glowMap[glow].shadow, borderColor: glowMap[glow].border }
    : {};

  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl border
        ${padding ? 'p-5 sm:p-6' : ''}
        ${gradient ? 'gradient-bg border-transparent' : ''}
        ${glass ? 'glass' : ''}
        ${hover || onClick ? 'card-lift cursor-pointer' : ''}
        ${className}
      `}
      style={{
        backgroundColor: gradient || glass ? undefined : 'var(--bg-secondary)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-card)',
        ...glowStyle,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
