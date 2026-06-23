import React, { useState } from 'react';

export default function Input({
  label,
  error,
  prefix,
  suffix,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  large = false,
  className = '',
  id,
  ...props
}) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
        >
          {label}
          {required && <span className="text-[var(--accent-red)] ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`
          relative flex items-center rounded-xl border-2 transition-all duration-200
          ${error ? 'border-[var(--accent-red)]' : focused ? 'border-[var(--accent-green)]' : 'border-transparent'}
          bg-[var(--bg-tertiary)]
          ${large ? 'p-1' : ''}
        `}
      >
        {prefix && (
          <span className="pl-4 text-[var(--text-secondary)] font-medium tabular-nums">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`
            w-full bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] placeholder:opacity-50
            ${large ? 'text-3xl font-semibold text-center py-4 tracking-tight' : 'px-4 py-2.5 text-sm'}
            ${prefix ? 'pl-2' : ''}
            ${suffix ? 'pr-2' : ''}
            ${isPassword ? 'pr-12' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            tabular-nums
          `}
          autoComplete={isPassword ? 'current-password' : 'off'}
          {...props}
        />
        {suffix && (
          <span className="pr-4 text-[var(--text-secondary)] font-medium">{suffix}</span>
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-[var(--accent-red)]">{error}</p>
      )}
    </div>
  );
}