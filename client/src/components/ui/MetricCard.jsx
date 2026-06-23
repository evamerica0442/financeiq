import React, { useRef, useEffect } from 'react';
import useCountUp from '../../hooks/useCountUp';

export default function MetricCard({
  title,
  value,
  prefix = 'R',
  delta,
  deltaLabel,
  icon,
  color = 'default',
  format = true,
  decimals = 0,
  className = '',
}) {
  const cardRef = useRef(null);
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : Number(value) || 0;
  const { count, observe } = useCountUp(numericValue, 800, false);

  useEffect(() => {
    if (cardRef.current) observe(cardRef.current);
  }, [cardRef, observe]);

  const formatCount = (num) => {
    if (!format) return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString('en-ZA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const deltaIsPositive = delta > 0;

  return (
    <div ref={cardRef} className="animate-on-mount">
      <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-[var(--shadow-card)] card-lift">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{title}</p>
          {icon && (
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${
              color === 'green' ? 'bg-[var(--accent-green)]/10' :
              color === 'red' ? 'bg-[var(--accent-red)]/10' :
              color === 'amber' ? 'bg-[var(--accent-amber)]/10' :
              color === 'blue' ? 'bg-[var(--accent-blue)]/10' :
              color === 'purple' ? 'bg-[var(--accent-purple)]/10' :
              'bg-[var(--bg-tertiary)]'
            }`}>
              {icon}
            </div>
          )}
        </div>
        <p className={`text-3xl font-bold tracking-tight tabular-nums ${
          color === 'green' ? 'text-[var(--accent-green)]' :
          color === 'red' ? 'text-[var(--accent-red)]' :
          'text-[var(--text-primary)]'
        }`}>
          {prefix}{formatCount(count)}
        </p>
        {delta !== undefined && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              deltaIsPositive ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'
            }`}>
              <svg className={`w-3 h-3 ${deltaIsPositive ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {deltaIsPositive ? '+' : ''}{Math.abs(delta).toFixed(1)}%
            </span>
            {deltaLabel && (
              <span className="text-xs text-[var(--text-secondary)]">{deltaLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}