import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { path: '/', label: 'Home', icon: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )},
  { path: '/transactions', label: 'Transactions', icon: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )},
  { path: '/budgets', label: 'Budgets', icon: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
  { path: '/goals', label: 'Goals', icon: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
  { path: '/advisor', label: 'AI', icon: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )},
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="glass border-t border-[var(--glass-border)]">
        <div className="flex items-center justify-around px-2 py-1">
          {TABS.map(tab => {
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="relative flex flex-col items-center gap-0.5 py-2 px-3 min-w-[56px] min-h-[44px]"
                aria-label={tab.label}
              >
                {isActive && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-[var(--accent-green)]" />
                )}
                <div className={`transition-colors duration-200 ${
                  isActive ? 'text-[var(--accent-green)]' : 'text-[var(--text-secondary)]'
                }`}>
                  {tab.icon}
                </div>
                <span className={`text-[10px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-[var(--accent-green)]' : 'text-[var(--text-secondary)]'
                }`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}