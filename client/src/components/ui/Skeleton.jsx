import React from 'react';

export default function Skeleton({ variant = 'text', width, height, className = '', count = 1 }) {
  const variants = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    avatar: 'h-10 w-10 rounded-full',
    card: 'h-32 w-full rounded-2xl',
    chart: 'h-48 w-full rounded-2xl',
    circle: 'h-12 w-12 rounded-full',
    badge: 'h-6 w-16 rounded-full',
    metric: 'h-24 w-full rounded-2xl',
  };

  if (count > 1) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`skeleton ${variants[variant] || variants.text} ${className}`}
            style={{
              width: width || undefined,
              height: height || undefined,
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton ${variants[variant] || variants.text} ${className}`}
      style={{
        width: width || undefined,
        height: height || undefined,
      }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Net worth banner */}
      <Skeleton variant="card" height="180px" />
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton variant="metric" />
        <Skeleton variant="metric" />
        <Skeleton variant="metric" />
        <Skeleton variant="metric" />
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton variant="chart" height="300px" />
        </div>
        <Skeleton variant="chart" height="300px" />
      </div>
      {/* Recent transactions */}
      <Skeleton variant="card" height="250px" />
    </div>
  );
}

export function TransactionListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton variant="circle" width="40px" height="40px" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" height="12px" />
          </div>
          <Skeleton variant="text" width="80px" />
        </div>
      ))}
    </div>
  );
}