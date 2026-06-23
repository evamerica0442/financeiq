import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { Bar } from 'react-chartjs-2';

export default function Reports() {
  const [report, setReport] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupRes, summaryRes] = await Promise.all([
        api.get(`/reports/group-spending?month=${filterMonth}`),
        api.get(`/reports/monthly-summary?month=${filterMonth}`),
      ]);
      setReport(groupRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }, [filterMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatCurrency = (n) => 'R' + Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Chart data for group spending
  const chartData = report?.groups?.length ? {
    labels: report.groups.map(g => g.groupName),
    datasets: [{
      label: 'Spending by Group',
      data: report.groups.map(g => g.total),
      backgroundColor: report.groups.map(g => g.color || '#8B92A5'),
      borderRadius: 6,
      borderSkipped: false,
    }],
  } : null;

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E2330',
        titleColor: '#F0F2F7',
        bodyColor: '#8B92A5',
        borderColor: '#2A2F3E',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: (ctx) => formatCurrency(ctx.parsed.x),
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(139,146,165,0.08)', drawBorder: false },
        ticks: {
          color: '#8B92A5',
          font: { size: 11, family: 'Inter' },
          callback: (v) => 'R' + (v / 1000).toFixed(0) + 'k',
        },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: '#8B92A5',
          font: { size: 12, family: 'Inter' },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <Skeleton variant="title" className="mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1"><Skeleton variant="card" height="200px" /></div>
          <div className="lg:col-span-2"><Skeleton variant="card" height="400px" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
      {/* Header */}
      <div className="animate-on-mount">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Spending Reports</h1>
        <p className="text-sm text-[var(--text-secondary)]">Group-level spending analysis</p>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            const d = new Date(filterMonth + '-01');
            d.setMonth(d.getMonth() - 1);
            setFilterMonth(d.toISOString().slice(0, 7));
          }}
          className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-lg font-semibold text-[var(--text-primary)]">
          {new Date(filterMonth + '-01').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => {
            const d = new Date(filterMonth + '-01');
            d.setMonth(d.getMonth() + 1);
            setFilterMonth(d.toISOString().slice(0, 7));
          }}
          className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.06em] mb-1">Income</p>
            <p className="text-2xl font-bold text-[var(--accent-green)] tabular-nums">{formatCurrency(summary.income)}</p>
          </Card>
          <Card>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.06em] mb-1">Expenses</p>
            <p className="text-2xl font-bold text-[var(--accent-red)] tabular-nums">{formatCurrency(summary.expenses)}</p>
          </Card>
          <Card>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.06em] mb-1">Savings</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: summary.savings >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {formatCurrency(summary.savings)}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.06em] mb-1">Savings Rate</p>
            <p className="text-2xl font-bold text-[var(--accent-blue)] tabular-nums">{summary.savingsRate}%</p>
          </Card>
        </div>
      )}

      {/* Chart + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Group Breakdown List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Spending by Group</h3>
          {report?.groups?.length > 0 ? report.groups.map((group, idx) => (
            <Card key={group.groupName} className="animate-on-mount" style={{ animationDelay: `${idx * 60}ms` }}>
              {/* Group Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>{group.icon || '📦'}</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{group.groupName}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatCurrency(group.total)}</p>
                  <p className="text-xs text-[var(--accent-green)] tabular-nums">{group.percentage}%</p>
                </div>
              </div>

              {/* Progress Bar */}
              {report.totalSpent > 0 && (
                <div className="w-full h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${group.percentage}%`,
                      backgroundColor: group.color || '#8B92A5',
                    }}
                  />
                </div>
              )}

              {/* Category Breakdown */}
              {group.categories?.length > 0 && (
                <div className="space-y-1 mt-2 pt-2 border-t border-[var(--border)]">
                  {group.categories.map(cat => (
                    <div key={cat.name} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-primary)] tabular-nums">{formatCurrency(cat.amount)}</span>
                        <span className="text-[var(--text-secondary)] w-8 text-right tabular-nums">{cat.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )) : (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3 text-2xl">📊</div>
              <p className="text-sm text-[var(--text-secondary)]">No spending data for this month</p>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="lg:col-span-2">
          <Card>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Group spending breakdown</h3>
            {chartData ? (
              <div style={{ height: Math.max(300, (report.groups.length || 1) * 50) }}>
                <Bar data={chartData} options={chartOpts} />
              </div>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <p className="text-sm text-[var(--text-secondary)]">No data to chart</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}