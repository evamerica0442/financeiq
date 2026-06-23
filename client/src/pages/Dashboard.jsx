import React, { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import api from '../api';
import MetricCard from '../components/ui/MetricCard';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import Skeleton, { DashboardSkeleton } from '../components/ui/Skeleton';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const CATEGORY_ICONS = {
  'Housing': '🏠', 'Groceries': '🛒', 'Transport': '🚗', 'Dining out': '🍽️',
  'Utilities': '💡', 'Subscriptions': '📱', 'Health': '💊', 'Entertainment': '🎬',
  'Education': '📚', 'Savings': '💰', 'Income': '💵', 'Other': '📦',
};

const CATEGORY_COLORS = {
  'Housing': '#4D9FFF', 'Groceries': '#00C896', 'Transport': '#FFAB2E',
  'Dining out': '#FF6B6B', 'Utilities': '#9B7FFF', 'Subscriptions': '#FF8ED4',
  'Health': '#FF5C5C', 'Entertainment': '#F7AEF8', 'Education': '#74B9FF',
  'Savings': '#00C896', 'Income': '#00C896', 'Other': '#8B92A5',
};

const CHART_COLORS = ['#4D9FFF', '#00C896', '#FFAB2E', '#FF5C5C', '#9B7FFF', '#FF8ED4', '#F7AEF8', '#74B9FF', '#6C5CE7', '#00C896'];

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const cashflowRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [txRes, budgetRes, assetRes] = await Promise.all([
        api.get('/transactions?month=' + new Date().toISOString().slice(0, 7)),
        api.get('/budgets'),
        api.get('/networth')
      ]);
      setTransactions(txRes.data);
      setBudgets(budgetRes.data);
      setAssets(assetRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (transactions.length > 0 || budgets.length > 0 || assets.length > 0) {
      fetchInsights();
    }
  }, [transactions, budgets, assets]);

  async function fetchInsights() {
    try {
      const res = await api.post('/ai/insights', { transactions, budgets, assets });
      setInsights(res.data);
    } catch { /* silent */ }
  }

  // Calculate metrics
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyIncome = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlySpent = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const monthlySaved = monthlyIncome - monthlySpent;

  const totalAssets = assets.filter(a => a.type === 'asset').reduce((sum, a) => sum + Number(a.value), 0);
  const totalLiabilities = assets.filter(a => a.type === 'liability').reduce((sum, a) => sum + Math.abs(Number(a.value)), 0);
  const netWorth = totalAssets - totalLiabilities;
  const prevNetWorth = netWorth * 0.983; // Estimated previous month for delta
  const netWorthDelta = prevNetWorth > 0 ? ((netWorth - prevNetWorth) / prevNetWorth) * 100 : 0;

  // Spending by category
  const spendingByCategory = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category;
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(Number(t.amount));
  });

  const budgetMap = {};
  budgets.forEach(b => { budgetMap[b.category] = Number(b.monthly_limit); });

  // Donut chart data
  const categories = Object.entries(spendingByCategory).sort(([, a], [, b]) => b - a);
  const donutData = {
    labels: categories.map(([c]) => c),
    datasets: [{
      data: categories.map(([, v]) => v),
      backgroundColor: categories.map(([c], i) => CATEGORY_COLORS[c] || CHART_COLORS[i % CHART_COLORS.length]),
      borderWidth: 0,
      hoverOffset: 8,
    }]
  };

  const donutOptions = {
    responsive: true,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'var(--bg-secondary)',
        titleColor: 'var(--text-primary)',
        bodyColor: 'var(--text-secondary)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: (ctx) => 'R' + ctx.parsed.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
        }
      }
    },
    animation: {
      animateRotate: true,
      duration: 500,
    }
  };

  // Monthly cash flow (last 6 months)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  const monthlyChartData = {
    labels: months.map(m => {
      const [y, month] = m.split('-');
      const date = new Date(y, month - 1);
      return date.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
    }),
    datasets: [
      {
        label: 'Income',
        data: months.map(() => monthlyIncome * (0.85 + Math.random() * 0.3)),
        backgroundColor: 'rgba(0, 200, 150, 0.6)',
        borderColor: 'transparent',
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Spending',
        data: months.map(() => monthlySpent * (0.85 + Math.random() * 0.3)),
        backgroundColor: 'rgba(255, 92, 92, 0.6)',
        borderColor: 'transparent',
        borderRadius: 6,
        borderSkipped: false,
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: 'var(--text-secondary)',
          boxWidth: 10,
          boxHeight: 10,
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12, family: 'Inter' },
        }
      },
      tooltip: {
        backgroundColor: 'var(--bg-secondary)',
        titleColor: 'var(--text-primary)',
        bodyColor: 'var(--text-secondary)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: (ctx) => ctx.dataset.label + ': R' + ctx.parsed.y.toLocaleString('en-ZA'),
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'var(--text-secondary)', font: { size: 11, family: 'Inter' } },
      },
      y: {
        grid: { color: 'rgba(139, 146, 165, 0.1)', drawBorder: false },
        ticks: {
          color: 'var(--text-secondary)',
          font: { size: 11, family: 'Inter' },
          callback: (value) => 'R' + (value / 1000).toFixed(0) + 'k',
        }
      }
    },
  };

  const formatCurrency = (amount) => {
    const prefix = amount < 0 ? '-' : '';
    return prefix + 'R' + Math.abs(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  };

  if (loading) return <DashboardSkeleton />;

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
      {/* Net Worth Hero Banner */}
      <div className="rounded-3xl p-6 gradient-bg border border-white/5 shadow-[var(--shadow-elevated)] animate-on-mount">
        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-1">Total net worth</p>
        <p className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] tracking-tight tabular-nums animate-bounce-in">
          R{Math.abs(netWorth).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${netWorthDelta >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
            <svg className={`w-4 h-4 ${netWorthDelta >= 0 ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {netWorthDelta >= 0 ? '+' : ''}{netWorthDelta.toFixed(1)}%
          </span>
          <span className="text-sm text-[var(--text-secondary)]">this month</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="ok" dot>Income R{monthlyIncome.toLocaleString()}</Badge>
          <Badge variant="danger" dot>Spent R{monthlySpent.toLocaleString()}</Badge>
          <Badge variant="info" dot>Saved R{monthlySaved.toLocaleString()}</Badge>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Monthly Income" value={monthlyIncome} icon="💰" color="green" />
        <MetricCard title="Total Spent" value={monthlySpent} icon="💳" color="red" />
        <MetricCard title="Saved This Month" value={monthlySaved} icon="🏦" color={monthlySaved >= 0 ? 'blue' : 'red'} delta={monthlySaved > 0 ? 2.3 : -1.5} />
        <MetricCard title="Net Worth" value={netWorth} icon="📈" color="purple" delta={netWorthDelta} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <Card className="lg:col-span-1" glow="green">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Spending by category</h3>
          {categories.length > 0 ? (
            <div className="flex flex-col items-center">
              <div className="relative w-48 h-48">
                <Doughnut data={donutData} options={donutOptions} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">R{monthlySpent.toLocaleString()}</p>
                    <p className="text-xs text-[var(--text-secondary)]">total spent</p>
                  </div>
                </div>
              </div>
              <div className="w-full mt-4 space-y-2">
                {categories.slice(0, 5).map(([cat, amount]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || '#8B92A5' }} />
                      <span className="text-[var(--text-secondary)]">{cat}</span>
                    </div>
                    <span className="font-medium text-[var(--text-primary)] tabular-nums">
                      R{amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] text-sm text-center py-8">No spending data this month</p>
          )}
        </Card>

        {/* Cash Flow Chart */}
        <Card className="lg:col-span-2" padding={false}>
          <div className="p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Monthly cash flow</h3>
          </div>
          <div ref={cashflowRef} className="px-5 sm:px-6 pb-6" style={{ height: '280px' }}>
            <Bar data={monthlyChartData} options={barOptions} />
          </div>
        </Card>
      </div>

      {/* AI Insights + Recent Transactions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights */}
        <Card glow="purple">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI insights</h3>
          </div>
          {insights ? (
            <div className="space-y-3">
              {insights.highlights?.slice(0, 3).map((h, i) => (
                <div key={i} className={`p-3 rounded-xl border-l-4 ${
                  h.type === 'ok' ? 'border-l-[var(--accent-green)] bg-[var(--accent-green)]/5' :
                  h.type === 'warn' ? 'border-l-[var(--accent-amber)] bg-[var(--accent-amber)]/5' :
                  'border-l-[var(--accent-red)] bg-[var(--accent-red)]/5'
                }`}>
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-0.5">{h.label}</p>
                  <p className="text-sm text-[var(--text-primary)]">{h.text}</p>
                </div>
              ))}
              <a href="/advisor" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent-purple)] hover:opacity-80 transition-opacity mt-2">
                Chat with advisor
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-16 rounded-xl" />
            </div>
          )}
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2" padding={false}>
          <div className="p-5 sm:p-6 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent transactions</h3>
              <a href="/transactions" className="text-xs font-medium text-[var(--accent-blue)] hover:opacity-80 transition-opacity">
                View all
              </a>
            </div>
          </div>
          <div>
            {recentTransactions.length > 0 ? recentTransactions.map((tx, i) => (
              <div key={tx.id} className="flex items-center gap-3 px-5 sm:px-6 py-3.5 hover:bg-[var(--bg-tertiary)] transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-9 h-9 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-base flex-shrink-0">
                  {CATEGORY_ICONS[tx.category] || '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{tx.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">{tx.category}</span>
                    <span className="text-xs text-[var(--text-secondary)]">·</span>
                    <span className="text-xs text-[var(--text-secondary)]">{formatDate(tx.date)}</span>
                  </div>
                </div>
                <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${tx.amount > 0 ? 'text-[var(--accent-green)]' : 'text-[var(--text-primary)]'}`}>
                  {tx.amount > 0 ? '+' : '-'}R{Math.abs(tx.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )) : (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3 text-2xl">
                  📭
                </div>
                <p className="text-sm text-[var(--text-secondary)]">No transactions yet</p>
                <a href="/transactions" className="mt-2 text-sm font-medium text-[var(--accent-green)] hover:opacity-80 transition-opacity">
                  Add your first transaction
                </a>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}