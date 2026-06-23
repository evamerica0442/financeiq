import React, { useEffect, useState } from 'react';

export default function ProgressArc({
  value = 0,
  max = 100,
  size = 100,
  strokeWidth = 8,
  color = 'auto',
  className = '',
  children,
}) {
  const [offset, setOffset] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - (percentage / 100) * circumference);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage, circumference]);

  const getColor = () => {
    if (color !== 'auto') return color;
    if (percentage >= 100) return 'stroke-[var(--accent-red)]';
    if (percentage >= 80) return 'stroke-[var(--accent-amber)]';
    if (percentage >= 50) return 'stroke-[var(--accent-blue)]';
    return 'stroke-[var(--accent-green)]';
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 800ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}