import React from 'react';

export default function AmountInput({
  value,
  onChange,
  label,
  error,
  prefix = 'R',
  placeholder = '0.00',
  required = false,
  className = '',
}) {
  function handleChange(e) {
    const raw = e.target.value.replace(/[^0-9.-]/g, '');
    if (raw === '' || /^-?\d*\.?\d{0,2}$/.test(raw)) {
      onChange(raw);
    }
  }

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-2 text-center">
          {label}
          {required && <span className="text-[var(--accent-red)] ml-0.5">*</span>}
        </p>
      )}
      <div
        className={`
          relative flex items-center justify-center rounded-2xl border-2 transition-all duration-200
          ${error ? 'border-[var(--accent-red)]' : 'border-transparent'}
          bg-[var(--bg-tertiary)] px-6 py-4
        `}
      >
        <span className="text-3xl font-semibold text-[var(--text-secondary)] mr-1">{prefix}</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          className="w-full bg-transparent text-4xl sm:text-5xl font-bold text-[var(--text-primary)] outline-none text-center tabular-nums tracking-tight"
          autoComplete="off"
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-[var(--accent-red)] text-center">{error}</p>
      )}
    </div>
  );
}