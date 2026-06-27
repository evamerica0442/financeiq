import React, { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import api from '../api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import BottomSheet from '../components/ui/BottomSheet';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../hooks/useToast';
import { useCategories } from '../hooks/useCategories';

ChartJS.register(ArcElement, Title, Tooltip, Legend);

const fmt = (n) =>
  'R' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatusBadge({ pct }) {
  if (pct >= 100) return <Badge variant="danger" size="sm" dot>Over budget</Badge>;
  if (pct >= 80)  return <Badge variant="warn"   size="sm" dot>Near limit</Badge>;
  return               <Badge variant="ok"    size="sm" dot>On track</Badge>;
}

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editBudget, setEditBudget] = useState(null);        // budget being edited
  const [formData, setFormData] = useState({ category: '', monthly_limit: '' });
  const [formError, setFormError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [groupAnalysis, setGroupAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const { addToast } = useToast();
  const { categories, loading: catLoading, getCategoryIcon, groups } = useCategories();

  // ── data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRes, txRes] = await Promise.all([
        api.get('/budgets'),
        api.get(`/transactions?month=${selectedMonth}`),
      ]);
      setBudgets(budgetRes.data);
      setTransactions(txRes.data);
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchGroupAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      const res = await api.get(`/analysis/spend-by-group?month=${selectedMonth}`);
      setGroupAnalysis(res.data);
    } catch (err) {
      console.error('Failed to fetch group analysis:', err);
    } finally {
      setAnalysisLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchGroupAnalysis(); }, [fetchGroupAnalysis]);

  // ── derived values ─────────────────────────────────────────────────────────
  const spendingByCategory = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + Math.abs(Number(t.amount));
  });

  const rows = budgets.map(b => {
    const budget  = Number(b.monthly_limit);
    const actual  = spendingByCategory[b.category] || 0;
    const remaining = budget - actual;
    const pct     = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
    return { ...b, budget, actual, remaining, pct };
  });

  const totalBudget  = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual  = rows.reduce((s, r) => s + r.actual, 0);
  const totalRemaining = totalBudget - totalActual;

  const budgetHealth = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + (r.pct <= 80 ? 1 : r.pct <= 100 ? 0.5 : 0), 0) / rows.length * 100)
    : 0;

  const usedCategories = new Set(budgets.map(b => b.category));

  // ── month navigation ───────────────────────────────────────────────────────
  function shiftMonth(delta) {
    const d = new Date(selectedMonth + '-01');
    d.setMonth(d.getMonth() + delta);
    setSelectedMonth(d.toISOString().slice(0, 7));
  }

  const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-ZA', {
    month: 'long', year: 'numeric',
  });

  // ── form handlers ──────────────────────────────────────────────────────────
  function openAdd() {
    setEditBudget(null);
    setFormData({ category: '', monthly_limit: '' });
    setFormError('');
    setShowSheet(true);
  }

  function openEdit(row, e) {
    e.stopPropagation();
    setEditBudget(row);
    setFormData({ category: row.category, monthly_limit: String(row.budget) });
    setFormError('');
    setShowSheet(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    const limit = parseFloat(formData.monthly_limit);
    if (!formData.category || isNaN(limit) || limit <= 0) {
      setFormError('A category and a positive monthly limit are required.');
      return;
    }
    try {
      await api.post('/budgets', { category: formData.category, monthly_limit: limit });
      addToast(editBudget ? 'Budget updated' : 'Budget added', 'success');
      setShowSheet(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save budget.');
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    try {
      await api.delete(`/budgets/${id}`);
      addToast('Budget deleted', 'info');
      fetchData();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  }

  // ── donut chart ────────────────────────────────────────────────────────────
  const donutOpts = {
    responsive: true, cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E2330', titleColor: '#F0F2F7', bodyColor: '#8B92A5',
        borderColor: '#2A2F3E', borderWidth: 1, padding: 12, cornerRadius: 12,
        callbacks: { label: (ctx) => fmt(ctx.parsed) },
      },
    },
    animation: { animateRotate: true, duration: 600 },
  };

  const groupDonutData = groupAnalysis?.groups?.length ? {
    labels: groupAnalysis.groups.map(g => g.groupName),
    datasets: [{
      data: groupAnalysis.groups.map(g => g.totalAmount),
      backgroundColor: groupAnalysis.groups.map(g => g.groupColor || '#8B92A5'),
      borderWidth: 0, hoverOffset: 10,
    }],
  } : null;

  // ── loading state ──────────────────────────────────────────────────────────
  if (loading || catLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <Skeleton variant="title" className="mb-6" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} variant="card" height="64px" />)}
        </div>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">

      {/* ── Header + month nav ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-on-mount">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Budget vs Actual</h1>
          <p className="text-sm text-[var(--text-secondary)]">{rows.length} budget{rows.length !== 1 ? 's' : ''} · {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)}
            className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Previous month">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-[var(--text-primary)] w-36 text-center tabular-nums">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)}
            className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Next month">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding className="text-center">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Budgeted</p>
          <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{fmt(totalBudget)}</p>
        </Card>
        <Card padding className="text-center">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Actual</p>
          <p className={`text-lg font-bold tabular-nums ${totalActual > totalBudget ? 'text-[var(--accent-red)]' : 'text-[var(--text-primary)]'}`}>
            {fmt(totalActual)}
          </p>
        </Card>
        <Card padding glow={totalRemaining < 0 ? 'red' : 'green'} className="text-center">
          <p className="text-xs text-[var(--text-secondary)] mb-1">{totalRemaining >= 0 ? 'Remaining' : 'Over by'}</p>
          <p className={`text-lg font-bold tabular-nums ${totalRemaining < 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
            {fmt(Math.abs(totalRemaining))}
          </p>
        </Card>
      </div>

      {/* ── Main content: budget table + donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Budget vs Actual table (left 2 cols) */}
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <Card padding className="flex flex-col items-center py-16 text-center">
              <div className="w-20 h-20 rounded-3xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 text-3xl">💰</div>
              <p className="text-lg font-medium text-[var(--text-primary)] mb-1">No budgets yet</p>
              <p className="text-sm text-[var(--text-secondary)] mb-4">Create your first budget to compare against actual spending.</p>
              <Button onClick={openAdd}>Create Budget</Button>
            </Card>
          ) : (
            <Card padding={false} className="overflow-hidden">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                <span>Category</span>
                <span className="text-right">Budgeted</span>
                <span className="text-right">Actual</span>
                <span className="text-right">Remaining</span>
                <span />
              </div>

              <div className="divide-y divide-[var(--border)]">
                {rows.map((row) => (
                  <div key={row.id} className="px-5 py-4 hover:bg-[var(--bg-tertiary)]/40 transition-colors">
                    {/* Mobile layout */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getCategoryIcon(row.category) || '📦'}</span>
                          <span className="font-medium text-[var(--text-primary)] text-sm">{row.category}</span>
                        </div>
                        <StatusBadge pct={row.pct} />
                      </div>
                      <div className="grid grid-cols-3 text-xs">
                        <div>
                          <p className="text-[var(--text-secondary)]">Budgeted</p>
                          <p className="font-semibold text-[var(--text-primary)] tabular-nums">{fmt(row.budget)}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-secondary)]">Actual</p>
                          <p className={`font-semibold tabular-nums ${row.pct >= 100 ? 'text-[var(--accent-red)]' : 'text-[var(--text-primary)]'}`}>{fmt(row.actual)}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-secondary)]">{row.remaining >= 0 ? 'Remaining' : 'Over'}</p>
                          <p className={`font-semibold tabular-nums ${row.remaining < 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>{fmt(Math.abs(row.remaining))}</p>
                        </div>
                      </div>
                      <ProgressBar value={row.actual} max={row.budget} height="h-2" />
                      <div className="flex gap-3 pt-1">
                        <button onClick={(e) => openEdit(row, e)} className="text-xs font-medium text-[var(--accent-blue)] hover:opacity-80 transition-opacity">Edit</button>
                        <button onClick={(e) => handleDelete(row.id, e)} className="text-xs font-medium text-[var(--accent-red)] hover:opacity-80 transition-opacity">Delete</button>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl flex-shrink-0">{getCategoryIcon(row.category) || '📦'}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text-primary)] text-sm truncate">{row.category}</p>
                          <ProgressBar value={row.actual} max={row.budget} height="h-1.5" className="mt-1 max-w-[160px]" />
                        </div>
                      </div>
                      <p className="text-sm text-right text-[var(--text-secondary)] tabular-nums">{fmt(row.budget)}</p>
                      <p className={`text-sm text-right font-medium tabular-nums ${row.pct >= 100 ? 'text-[var(--accent-red)]' : 'text-[var(--text-primary)]'}`}>{fmt(row.actual)}</p>
                      <div className="flex flex-col items-end gap-1">
                        <p className={`text-sm font-semibold tabular-nums ${row.remaining < 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
                          {row.remaining < 0 ? '-' : ''}{fmt(Math.abs(row.remaining))}
                        </p>
                        <StatusBadge pct={row.pct} />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <button onClick={(e) => openEdit(row, e)} className="text-xs font-medium text-[var(--accent-blue)] hover:opacity-80 transition-opacity whitespace-nowrap">Edit</button>
                        <button onClick={(e) => handleDelete(row.id, e)} className="text-xs font-medium text-[var(--accent-red)] hover:opacity-80 transition-opacity">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table footer totals */}
              <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-tertiary)]/50">
                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Total</span>
                <span className="text-sm text-right font-bold text-[var(--text-primary)] tabular-nums">{fmt(totalBudget)}</span>
                <span className={`text-sm text-right font-bold tabular-nums ${totalActual > totalBudget ? 'text-[var(--accent-red)]' : 'text-[var(--text-primary)]'}`}>{fmt(totalActual)}</span>
                <span className={`text-sm text-right font-bold tabular-nums ${totalRemaining < 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
                  {totalRemaining < 0 ? '-' : ''}{fmt(Math.abs(totalRemaining))}
                </span>
                <span />
              </div>
            </Card>
          )}
        </div>

        {/* Spend by Group donut (right col) */}
        <div className="rounded-2xl p-5 border border-[var(--border)] bg-[var(--bg-secondary)] shadow-[0_2px_12px_rgba(0,0,0,0.4)] flex flex-col">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Spend by group</h3>

          {analysisLoading ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
            </div>
          ) : groupDonutData ? (
            <div className="flex flex-col items-center">
              <div className="relative w-44 h-44">
                <Doughnut data={groupDonutData} options={donutOpts} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{fmt(groupAnalysis?.grandTotal || 0)}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">total spent</p>
                  </div>
                </div>
              </div>
              <div className="w-full mt-4 space-y-2.5">
                {groupAnalysis?.groups?.map(g => (
                  <div key={g.groupId || g.groupName} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.groupColor || '#8B92A5' }} />
                      <span className="text-[var(--text-secondary)] text-xs">{g.groupName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--text-secondary)] tabular-nums">{g.percentageOfTotal}%</span>
                      <span className="font-medium text-[var(--text-primary)] tabular-nums text-xs">{fmt(g.totalAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] text-sm text-center py-10 flex-1">No spending data this month</p>
          )}

          {/* Budget health at bottom */}
          {rows.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--text-secondary)]">Budget health</span>
                <span className={`text-sm font-bold tabular-nums ${budgetHealth >= 80 ? 'text-[var(--accent-green)]' : budgetHealth >= 50 ? 'text-[var(--accent-amber)]' : 'text-[var(--accent-red)]'}`}>{budgetHealth}%</span>
              </div>
              <ProgressBar value={budgetHealth} max={100} height="h-2" />
              <p className="text-[11px] text-[var(--text-secondary)] mt-2">
                {budgetHealth >= 80 ? 'Well within limits across all categories.' :
                 budgetHealth >= 50 ? 'Some categories need attention.' :
                 'Several budgets are being exceeded.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── FAB ── */}
      {rows.length > 0 && (
        <button
          onClick={openAdd}
          className="fixed bottom-20 lg:bottom-8 right-6 z-40 w-14 h-14 rounded-2xl bg-[var(--accent-green)] text-[#0D0F14] shadow-[var(--shadow-glow-green)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Add budget"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* ── Add / Edit bottom sheet ── */}
      <BottomSheet isOpen={showSheet} onClose={() => setShowSheet(false)} title={editBudget ? 'Edit Budget' : 'Add Budget'}>
        {formError && (
          <div className="mb-4 p-3 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 text-[var(--accent-red)] rounded-xl text-sm">{formError}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category selector — disabled when editing */}
          {editBudget ? (
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Category</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
                <span className="text-base">{getCategoryIcon(editBudget.category) || '📦'}</span>
                <span className="text-sm text-[var(--text-primary)]">{editBudget.category}</span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Category</p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {groups.length > 0 ? groups.map(group => (
                  <div key={group.id} className="w-full">
                    <p className="text-xs text-[var(--text-secondary)] mb-1 px-1">{group.icon} {group.name}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {group.categories?.filter(cat => !usedCategories.has(cat.name)).map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: cat.name })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            formData.category === cat.name
                              ? 'bg-[var(--accent-green)] text-[#0D0F14]'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {cat.icon || '📦'} {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--text-secondary)] py-4 text-center w-full">No categories available</p>
                )}
              </div>
              {categories.filter(c => !usedCategories.has(c.name)).length === 0 && categories.length > 0 && (
                <p className="text-sm text-[var(--text-secondary)] py-2 text-center">All categories already have budgets</p>
              )}
            </div>
          )}

          <Input
            label="Monthly limit (R)"
            type="number"
            step="0.01"
            min="0"
            value={formData.monthly_limit}
            onChange={(e) => setFormData({ ...formData, monthly_limit: e.target.value })}
            placeholder="5000"
            required
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setShowSheet(false)}>Cancel</Button>
            <Button type="submit" fullWidth disabled={!formData.category || !formData.monthly_limit}>
              {editBudget ? 'Update Budget' : 'Set Budget'}
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}
