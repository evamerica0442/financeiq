import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import api from '../api';
import useCountUp from '../hooks/useCountUp';
import { useCategories } from '../hooks/useCategories';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  'R' + Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtShort = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return 'R' + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return 'R' + (abs / 1_000).toFixed(1) + 'k';
  return 'R' + abs.toLocaleString('en-ZA', { minimumFractionDigits: 0 });
};

const fmtDate = (s) => {
  const d = new Date(s);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
};

// ─── Animated metric display ─────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = 'R', decimals = 0, className = '', style }) {
  const numValue = Number(value);
  const { count, start } = useCountUp(numValue, 800, true);
  const nodeRef = useRef(null);

  // Re-animate when value changes (e.g. data loads after skeleton)
  useEffect(() => {
    if (numValue > 0) {
      const raf = requestAnimationFrame(() => start());
      return () => cancelAnimationFrame(raf);
    }
  }, [numValue, start]);

  const display = (() => {
    const n = count;
    if (n >= 1_000_000) return prefix + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return prefix + (n / 1_000).toFixed(1) + 'k';
    return prefix + n.toLocaleString('en-ZA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  })();

  return <span ref={nodeRef} className={`tabular-nums tracking-tight ${className}`} style={style}>{display}</span>;
}

// ─── Skeleton placeholder ────────────────────────────────────────────────────
function DashSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
      <div className="skeleton h-44 rounded-3xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 skeleton h-80 rounded-2xl" />
        <div className="lg:col-span-2 skeleton h-80 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 skeleton h-64 rounded-2xl" />
        <div className="lg:col-span-2 skeleton h-64 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [txns, setTxns] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [allTxns, setAllTxns] = useState([]); // 6 months of transactions for bar chart
  const [insights, setInsights] = useState(null);
  const [networthInsights, setNetworthInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [groupAnalysis, setGroupAnalysis] = useState(null);
  const [analysisMonth, setAnalysisMonth] = useState(new Date().toISOString().slice(0, 7));
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const chartRef = useRef(null);
  const { categories, loading: catLoading, getCategoryIcon, getCategoryColor, groups } = useCategories();

  const currentMonth = new Date().toISOString().slice(0, 7);

  const handleExport = () => {
    setExporting(true);
    window.open(`/api/export/report?month=${currentMonth}`, '_blank');
    setTimeout(() => setExporting(false), 2000);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchNetworthInsights(); }, []);

  async function fetchData() {
    try {
      const [txRes, bRes, aRes, allTxRes] = await Promise.all([
        api.get('/transactions?month=' + currentMonth),
        api.get('/budgets'),
        api.get('/networth'),
        api.get('/transactions?status=all'), // all transactions for 6-month chart
      ]);
      setTxns(txRes.data);
      setBudgets(bRes.data);
      setAssets(aRes.data);
      setAllTxns(allTxRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchNetworthInsights() {
    try {
      const res = await api.get('/networth/insights');
      setNetworthInsights(res.data);
    } catch (e) {
      // Non-critical — don't log
    }
  }

  useEffect(() => {
    if (txns.length || budgets.length || assets.length) {
      api.post('/ai/insights', { transactions: txns, budgets, assets })
        .then(r => setInsights(r.data))
        .catch(() => {});
    }
  }, [txns.length, budgets.length, assets.length]);

  // Fetch spend-by-group analysis
  const fetchGroupAnalysis = useCallback(async (month) => {
    setAnalysisLoading(true);
    try {
      const res = await api.get(`/analysis/spend-by-group?month=${month}`);
      setGroupAnalysis(res.data);
    } catch (err) {
      console.error('Failed to fetch group analysis:', err);
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroupAnalysis(analysisMonth);
  }, [analysisMonth, fetchGroupAnalysis]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const income = txns.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const spent = txns.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const saved = income - spent;

  const totAssets = assets.filter(a => a.type === 'asset').reduce((s, a) => s + Number(a.value), 0);
  const totLiabs = assets.filter(a => a.type === 'liability').reduce((s, a) => s + Math.abs(Number(a.value)), 0);
  const netWorth = totAssets - totLiabs;
  const netDelta = netWorth > 0 ? (((netWorth - (totAssets * 0.983 - totLiabs)) / (totAssets * 0.983 - totLiabs)) * 100) : 0;

  // spending by category (expenses only) for donut
  const byCat = {};
  txns.filter(t => Number(t.amount) < 0).forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + Math.abs(Number(t.amount));
  });
  const catEntries = Object.entries(byCat).sort(([, a], [, b]) => b - a);

  // donut
  const donutData = catEntries.length
    ? {
        labels: catEntries.map(([c]) => c),
        datasets: [{
          data: catEntries.map(([, v]) => v),
          backgroundColor: catEntries.map(([c]) => getCategoryColor(c) || '#8B92A5'),
          borderWidth: 0,
          hoverOffset: 10,
        }],
      }
    : null;

  const donutOpts = {
    responsive: true, cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E2330', titleColor: '#F0F2F7', bodyColor: '#8B92A5',
        borderColor: '#2A2F3E', borderWidth: 1, padding: 12, cornerRadius: 12,
        callbacks: { label: (ctx) => 'R' + ctx.parsed.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) },
      },
    },
    animation: { animateRotate: true, duration: 600 },
  };

  // ── Real 6-month bar chart (aggregated from all transactions) ──────────
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  // Aggregate all transactions by month for income and spending
  const monthlyIncome = {};
  const monthlySpending = {};
  allTxns.forEach(t => {
    const txMonth = t.date ? t.date.substring(0, 7) : null;
    if (!txMonth) return;
    const amt = Number(t.amount);
    if (amt > 0) {
      monthlyIncome[txMonth] = (monthlyIncome[txMonth] || 0) + amt;
    } else if (amt < 0) {
      monthlySpending[txMonth] = (monthlySpending[txMonth] || 0) + Math.abs(amt);
    }
  });

  const barData = {
    labels: months.map(m => {
      const [y, mo] = m.split('-');
      return new Date(y, mo - 1).toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
    }),
    datasets: [
      {
        label: 'Income',
        data: months.map(m => monthlyIncome[m] || 0),
        backgroundColor: 'rgba(0,200,150,0.55)',
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Spending',
        data: months.map(m => monthlySpending[m] || 0),
        backgroundColor: 'rgba(255,92,92,0.55)',
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true, position: 'top', align: 'end',
        labels: {
          color: '#8B92A5', boxWidth: 10, boxHeight: 10, padding: 16,
          usePointStyle: true, pointStyle: 'circle', font: { size: 12, family: 'Inter' },
        },
      },
      tooltip: {
        backgroundColor: '#1E2330', titleColor: '#F0F2F7', bodyColor: '#8B92A5',
        borderColor: '#2A2F3E', borderWidth: 1, padding: 12, cornerRadius: 12,
        callbacks: { label: (ctx) => ctx.dataset.label + ': R' + ctx.parsed.y.toLocaleString('en-ZA') },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#8B92A5', font: { size: 11, family: 'Inter' } } },
      y: {
        grid: { color: 'rgba(139,146,165,0.08)', drawBorder: false },
        ticks: {
          color: '#8B92A5', font: { size: 11, family: 'Inter' },
          callback: (v) => 'R' + (v / 1000).toFixed(0) + 'k',
        },
      },
    },
  };

  // Spend-by-group donut data
  const groupDonutData = groupAnalysis?.groups?.length
    ? {
        labels: groupAnalysis.groups.map(g => g.groupName),
        datasets: [{
          data: groupAnalysis.groups.map(g => g.totalAmount),
          backgroundColor: groupAnalysis.groups.map(g => g.groupColor || '#8B92A5'),
          borderWidth: 0,
          hoverOffset: 10,
        }],
      }
    : null;

  // Top 3 summary
  const top3 = groupAnalysis?.groups?.slice(0, 3) || [];

  // Wait for categories to load too before showing non-skeleton content
  if (loading || catLoading) return <DashSkeleton />;

  const recent = txns.slice(0, 5);

  // Recalculate netDelta properly from previous month
  const previousMonth = new Date();
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const prevMonthKey = previousMonth.toISOString().slice(0, 7);
  const prevIncome = allTxns
    .filter(t => t.date && t.date.substring(0, 7) === prevMonthKey && Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const prevSpent = allTxns
    .filter(t => t.date && t.date.substring(0, 7) === prevMonthKey && Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const prevSaved = prevIncome - prevSpent;
  const netDeltaCalc = prevSaved !== 0 ? ((saved - prevSaved) / Math.abs(prevSaved)) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div
          className="flex-1 rounded-3xl p-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1A1F2E 0%, #0D0F14 100%)',
            border: '1px solid rgba(255,255,255,0.04)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* Glow orbs */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#00C896]/5 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-[#4D9FFF]/5 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <p className="text-[11px] font-semibold text-[#8B92A5] uppercase tracking-[0.08em] mb-1">
              Total net worth
            </p>
            <div className="flex items-baseline gap-3">
              <AnimatedNumber
                value={netWorth}
                decimals={0}
                className="text-4xl sm:text-5xl font-bold text-[#F0F2F7]"
              />
              <span className={`inline-flex items-center gap-1 text-sm font-medium ${netDeltaCalc >= 0 ? 'text-[#00C896]' : 'text-[#FF5C5C]'}`}>
                <svg className={`w-4 h-4 ${netDeltaCalc >= 0 ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {netDeltaCalc >= 0 ? '+' : ''}{netDeltaCalc.toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#00C896]/10 text-[#00C896] border border-[#00C896]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C896]" />
                Income R{income.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FF5C5C]/10 text-[#FF5C5C] border border-[#FF5C5C]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C5C]" />
                Spent R{spent.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#4D9FFF]/10 text-[#4D9FFF] border border-[#4D9FFF]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4D9FFF]" />
                Saved R{saved.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex-shrink-0"
          style={{
            backgroundColor: '#1E2330',
            color: '#8B92A5',
            border: '1px solid #2A2F3E',
            opacity: exporting ? 0.6 : 1,
          }}
          title="Export monthly report"
        >
          {exporting ? (
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#00C896', borderTopColor: 'transparent' }} />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          <span className="hidden sm:inline">Export report</span>
        </button>
      </div>


      {/* ── Metric cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { title: 'Monthly Income', value: income, color: '#00C896', icon: '💰' },
          { title: 'Total Spent', value: spent, color: '#FF5C5C', icon: '💳' },
          { title: 'Saved This Month', value: saved, color: saved >= 0 ? '#4D9FFF' : '#FF5C5C', icon: '🏦' },
          { title: 'Net Worth', value: netWorth, color: '#9B7FFF', icon: '📈', insight: networthInsights },
        ].map((m, i) => (
          <div
            key={i}
            className="rounded-2xl p-5 border border-[#2A2F3E] bg-[#161A23] shadow-[0_2px_12px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-medium text-[#8B92A5] uppercase tracking-[0.06em]">{m.title}</p>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
                style={{ backgroundColor: m.color + '15' }}
              >
                {m.icon}
              </div>
            </div>
            <AnimatedNumber
              value={m.value}
              decimals={0}
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: m.color }}
            />
            {m.insight && m.title === 'Net Worth' && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    m.insight.trend === 'up' ? 'text-[#00C896]' :
                    m.insight.trend === 'down' ? 'text-[#FF5C5C]' : 'text-[#8B92A5]'
                  }`}>
                    <svg className={`w-3 h-3 ${m.insight.trend === 'down' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    {m.insight.change >= 0 ? '+' : ''}{m.insight.changePercent}%
                  </span>
                  <span className="text-[10px] text-[#8B92A5]">vs last month</span>
                </div>
                {m.insight.biggestAssetGain?.name !== 'N/A' && (
                  <p className="text-[10px] text-[#8B92A5] leading-tight">
                    🏆 {m.insight.biggestAssetGain.name} grew R{(m.insight.biggestAssetGain.change || 0).toLocaleString()}
                  </p>
                )}
                {m.insight.projectedNetWorth12Months && (
                  <p className="text-[10px] text-[#4D9FFF] leading-tight">
                    📈 Projected: R{m.insight.projectedNetWorth12Months.toLocaleString()} in 12 months
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spend by Category Donut */}
        <div className="rounded-2xl p-6 border border-[#2A2F3E] bg-[#161A23] shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
          <h3 className="text-sm font-semibold text-[#F0F2F7] mb-4">Spending by category</h3>
          {donutData ? (
            <div className="flex flex-col items-center">
              <div className="relative w-48 h-48">
                <Doughnut data={donutData} options={donutOpts} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xl font-bold text-[#F0F2F7] tabular-nums">{fmtShort(spent)}</p>
                    <p className="text-[11px] text-[#8B92A5]">total spent</p>
                  </div>
                </div>
              </div>
              <div className="w-full mt-4 space-y-2">
                {catEntries.slice(0, 5).map(([cat, amt]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(cat) || '#8B92A5' }} />
                      <span className="text-[#8B92A5]">{getCategoryIcon(cat) || '📦'} {cat}</span>
                    </div>
                    <span className="font-medium text-[#F0F2F7] tabular-nums">{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[#8B92A5] text-sm text-center py-10">No spending data this month</p>
          )}
        </div>

        {/* Spend by Group Donut */}
        <div className="rounded-2xl p-6 border border-[#2A2F3E] bg-[#161A23] shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#F0F2F7]">Spend by group</h3>
            {/* Month selector for analysis */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const d = new Date(analysisMonth + '-01');
                  d.setMonth(d.getMonth() - 1);
                  setAnalysisMonth(d.toISOString().slice(0, 7));
                }}
                className="p-1 rounded text-[#8B92A5] hover:text-[#F0F2F7] transition-colors"
                aria-label="Previous month"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[11px] text-[#8B92A5] font-medium tabular-nums">
                {new Date(analysisMonth + '-01').toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })}
              </span>
              <button
                onClick={() => {
                  const d = new Date(analysisMonth + '-01');
                  d.setMonth(d.getMonth() + 1);
                  setAnalysisMonth(d.toISOString().slice(0, 7));
                }}
                className="p-1 rounded text-[#8B92A5] hover:text-[#F0F2F7] transition-colors"
                aria-label="Next month"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {analysisLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#00C896', borderTopColor: 'transparent' }} />
            </div>
          ) : groupDonutData ? (
            <div className="flex flex-col items-center">
              <div className="relative w-48 h-48">
                <Doughnut data={groupDonutData} options={donutOpts} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xl font-bold text-[#F0F2F7] tabular-nums">{fmtShort(groupAnalysis?.grandTotal || 0)}</p>
                    <p className="text-[11px] text-[#8B92A5]">total spent</p>
                  </div>
                </div>
              </div>
              <div className="w-full mt-4 space-y-2">
                {groupAnalysis?.groups?.map(g => (
                  <div key={g.groupId || g.groupName} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.groupColor || '#8B92A5' }} />
                      <span className="text-[#8B92A5]">{g.groupName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[#8B92A5] tabular-nums">{g.percentageOfTotal}%</span>
                      <span className="font-medium text-[#F0F2F7] tabular-nums">{fmt(g.totalAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Top 3 summary — built with proper JSX elements, not string interpolation */}
              {top3.length >= 2 && (
                <div className="mt-3 p-3 rounded-xl w-full bg-[#1E2330] border border-[#2A2F3E]">
                  <p className="text-[11px] text-[#8B92A5] leading-relaxed">
                    You spent the most on{' '}
                    <span style={{ color: top3[0]?.groupColor || '#8B92A5' }} className="font-medium">{top3[0]?.groupName}</span>
                    {top3[0] ? ` (${top3[0]?.percentageOfTotal}%)` : ''}
                    {top3[1] ? (
                      <>, then on{' '}
                        <span style={{ color: top3[1]?.groupColor || '#8B92A5' }} className="font-medium">{top3[1]?.groupName}</span>
                        {' '}({top3[1]?.percentageOfTotal}%)</>
                    ) : ''}
                    {top3[2] ? (
                      <>, then on{' '}
                        <span style={{ color: top3[2]?.groupColor || '#8B92A5' }} className="font-medium">{top3[2]?.groupName}</span>
                        {' '}({top3[2]?.percentageOfTotal}%)</>
                    ) : ''}.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#8B92A5] text-sm text-center py-10">No spending data this month</p>
          )}
        </div>

        {/* Real 6-month Bar chart */}
        <div className="lg:col-span-1 rounded-2xl border border-[#2A2F3E] bg-[#161A23] shadow-[0_2px_12px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="p-6 pb-2">
            <h3 className="text-sm font-semibold text-[#F0F2F7]">Monthly cash flow</h3>
          </div>
          <div ref={chartRef} className="px-6 pb-6" style={{ height: 280 }}>
            <Bar data={barData} options={barOpts} />
          </div>
        </div>
      </div>

      {/* ── AI insights + transactions row ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI panel */}
        <div
          className="rounded-2xl p-6 border bg-[#161A23]"
          style={{
            borderColor: 'rgba(155,127,255,0.2)',
            boxShadow: '0 0 20px rgba(155,127,255,0.08), 0 2px 12px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-[#9B7FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-sm font-semibold text-[#F0F2F7]">AI insights</h3>
          </div>

          {insights ? (
            <div className="space-y-3">
              {insights.highlights?.slice(0, 3).map((h, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border-l-4"
                  style={{
                    borderLeftColor: h.type === 'ok' ? '#00C896' : h.type === 'warn' ? '#FFAB2E' : '#FF5C5C',
                    backgroundColor: (h.type === 'ok' ? '#00C896' : h.type === 'warn' ? '#FFAB2E' : '#FF5C5C') + '08',
                  }}
                >
                  <p className="text-[11px] font-medium text-[#8B92A5] mb-0.5">{h.label}</p>
                  <p className="text-sm text-[#F0F2F7] leading-relaxed">{h.text}</p>
                </div>
              ))}
              <a
                href="/advisor"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#9B7FFF] hover:opacity-80 transition-opacity mt-1"
              >
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
        </div>

        {/* Recent transactions */}
        <div className="lg:col-span-2 rounded-2xl border border-[#2A2F3E] bg-[#161A23] shadow-[0_2px_12px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2A2F3E] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F0F2F7]">Recent transactions</h3>
            <a href="/transactions" className="text-xs font-medium text-[#4D9FFF] hover:opacity-80 transition-opacity">
              View all
            </a>
          </div>

          {recent.length > 0 ? (
            <div className="divide-y divide-[#2A2F3E]/50">
              {recent.map((tx, i) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-[#1E2330] transition-colors duration-150"
                  style={{ animation: `fadeInUp 0.3s ease-out ${i * 60}ms both` }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                    style={{ backgroundColor: (tx.category_color || getCategoryColor(tx.category) || '#8B92A5') + '18' }}
                  >
                    {tx.category_icon || getCategoryIcon(tx.category) || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#F0F2F7] truncate">{tx.name}</p>
                    <div className="flex items-center gap-2 text-xs text-[#8B92A5]">
                      <span>{tx.category}</span>
                      <span>·</span>
                      <span>{fmtDate(tx.date)}</span>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                      tx.amount > 0 ? 'text-[#00C896]' : 'text-[#F0F2F7]'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : '-'}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1E2330] flex items-center justify-center mb-3 text-2xl">📭</div>
              <p className="text-sm text-[#8B92A5]">No transactions this month</p>
              <a href="/transactions" className="mt-2 text-sm font-medium text-[#00C896] hover:opacity-80 transition-opacity">
                Add your first transaction
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Keyframe injection for staggered animation ──────────────────── */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}