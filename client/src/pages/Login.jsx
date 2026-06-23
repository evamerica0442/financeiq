import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0D0F14' }}
    >
      {/* Subtle animated glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#00C896]/4 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#4D9FFF]/4 blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      </div>

      <div
        className="relative w-full max-w-sm"
        style={{ animation: 'fadeInUp 0.5s ease-out both' }}
      >
        {/* Logo + branding */}
        <div className="text-center mb-10">
          {/* Coin icon */}
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{
              backgroundColor: '#00C896',
              boxShadow: '0 0 30px rgba(0,200,150,0.25)',
            }}
          >
            <svg className="w-8 h-8 text-[#0D0F14]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h1
            className="text-4xl font-bold tracking-tight"
            style={{
              color: '#F0F2F7',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            FinanceIQ
          </h1>
          <p className="text-sm mt-2" style={{ color: '#8B92A5' }}>
            Your money. Understood.
          </p>
        </div>

        {/* Frosted glass card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'rgba(22, 26, 35, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(42, 47, 62, 0.5)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <h2
            className="text-xl font-semibold mb-6"
            style={{ color: '#F0F2F7', fontFamily: 'Inter, sans-serif' }}
          >
            Welcome back
          </h2>

          {/* Error message */}
          {error && (
            <div
              className="mb-5 p-3 rounded-xl text-sm"
              style={{
                backgroundColor: 'rgba(255,92,92,0.1)',
                border: '1px solid rgba(255,92,92,0.2)',
                color: '#FF5C5C',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#8B92A5' }}
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                style={{
                  backgroundColor: '#1E2330',
                  color: '#F0F2F7',
                  border: '2px solid transparent',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#00C896';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,200,150,0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'transparent';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#8B92A5' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    backgroundColor: '#1E2330',
                    color: '#F0F2F7',
                    border: '2px solid transparent',
                    paddingRight: '44px',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#00C896';
                    e.target.style.boxShadow = '0 0 0 3px rgba(0,200,150,0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'transparent';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors"
                  style={{ color: '#8B92A5' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F2F7')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#8B92A5')}
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
              </div>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: '#00C896',
                color: '#0D0F14',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.01)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(0,200,150,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1" style={{ height: '1px', backgroundColor: '#2A2F3E' }} />
            <span className="text-xs" style={{ color: '#8B92A5' }}>or</span>
            <div className="flex-1" style={{ height: '1px', backgroundColor: '#2A2F3E' }} />
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={() => {}}
            className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-3 transition-all duration-200"
            style={{
              backgroundColor: '#1E2330',
              color: '#F0F2F7',
              border: '1px solid #2A2F3E',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2A2F3E';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1E2330';
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Register link */}
          <p className="mt-6 text-center text-sm" style={{ color: '#8B92A5' }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium transition-opacity"
              style={{ color: '#00C896' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Sign up
            </Link>
          </p>

          {/* Demo hint */}
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2A2F3E' }}>
            <p className="text-xs text-center" style={{ color: '#8B92A5', opacity: 0.6 }}>
              Demo: demo@financeiq.app / demo1234
            </p>
          </div>
        </div>
      </div>

      {/* Inline keyframe for the card entrance */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}