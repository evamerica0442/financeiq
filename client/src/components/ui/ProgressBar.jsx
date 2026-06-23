import React, { useEffect, useRef, useState } from 'react';

export default function ProgressBar({
  value = 0,
  max = 100,
  color = 'auto',
  height = 'h-3',
  showLabel = false,
  animated = true,
  className = '',
}) {
  const barRef = useRef(null);
  const [width, setWidth] = useState(0);
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  useEffect(() => {
    if (!animated) {
      setWidth(percentage);
      return;
    }
    const timer = setTimeout(() => setWidth(percentage), 100);
    return () => clearTimeout(timer);
  }, [percentage, animated]);

  const getColor = () => {
    if (color !== 'auto') return color;
    if (percentage >= 100) return 'bg-[var(--accent-red)]';
    if (percentage >= 80) return 'bg-[var(--accent-amber)]';
    if (percentage >= 50) return 'bg-[var(--accent-blue)]';
    return 'bg-[var(--accent-green)]';
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={barRef}
        className="w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden"
        style={{ height: height === 'h-3' ? '12px' : height === 'h-2' ? '8px' : '16px' }}
      >
        <div
          className={`h-full rounded-full transition-all duration-600 ease-out ${getColor()}`}
          style={{
            width: `${width}%`,
            transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-[var(--text-secondary)] mt-1.5 text-right tabular-nums">
          {percentage.toFixed(1)}%
        </p>
      )}
    </div>
  );
}