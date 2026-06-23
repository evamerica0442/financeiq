import React, { useState, useEffect } from 'react';
import api from '../api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProgressArc from '../components/ui/ProgressArc';
import ProgressBar from '../components/ui/ProgressBar';
import BottomSheet from '../components/ui/BottomSheet';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../hooks/useToast';

const CATEGORIES = ['Housing', 'Groceries', 'Transport', 'Dining out', 'Utilities', 'Subscriptions', 'Health', 'Entertainment', 'Education', 'Savings', 'Income', 'Other'];

const CATEGORY_ICONS = {
  'Housing': '🏠', 'Groceries': '🛒', 'Transport': '🚗', 'Dining out': '🍽️',
  'Utilities': '💡', 'Subscriptions': '📱', 'Health': '💊', 'Entertainment': '🎬',
  'Education': '📚', 'Savings': '💰', 'Income': '💵', 'Other': '📦',
};

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [expandedBudget, setExpandedBudget] = useState(null);
  const [formData, setFormData] = useState({ category: '', monthly_limit: '' });
  const [formError, setFormError] = useState('');
  const { addToast } = useToast();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [budgetRes, txRes] = await Promise.all([
        api.get('/budgets'),
        api.get(`/transactions?month=${currentMonth}`)
      ]);
      setBudgets(budgetRes.data);
      setTransactions(txRes.data);
    } catch (err) {
      console.error('Failed to fetch budgets:', err);
    } finally {
      setLoading(false);
    }
  }

  const spendingByCategory = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category;
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(Number(t.amount));
  });

  function openAddSheet() {
    setFormData({ category: '', monthly_limit: '' });
    setFormError('');
    setShowSheet(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!formData.category || !formData.monthly_limit) {
      setFormError('Category and monthly limit are required.');
      return;
    }

    const limit = parseFloat(formData.monthly_limit);
    if (isNaN(limit) || limit <= 0) {
      setFormError('Monthly limit must be a positive number.');
      return;
    }

    try {
      await api.post('/budgets', { category: formData.category, monthly_limit: limit });
      addToast('Budget added', 'success');
      setShowSheet(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save budget.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/budgets/${id}`);
      addToast('Budget deleted', 'info');
      fetchData();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  }

  const usedCategories = new Set(budgets.map(b => b.category));
  const availableCategories = CATEGORIES.filter(c => !usedCategories.has(c));

  // Budget health score
  const budgetHealth = budgets.length > 0
    ? Math.round(budgets.reduce((sum, b) => {
        const spent = spendingByCategory[b.category] || 0;
        const pct = Number(b.monthly_limit) > 0 ? (spent / Number(b.monthly_limit)) * 100 : 0;
        return sum + (pct <= 80 ? 1 : pct <= 100 ? 0.5 : 0);
      }, 0) / budgets.length * 100)
    : 0;

  const formatCurrency = (amount) => 'R' + Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <Skeleton variant="title" className="mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="card" height="180px" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
      {/* Header */}
      <div className="animate-on-mount">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Budgets</h1>
        <p className="text-sm text-[var(--text-secondary)]">{budgets.length} active budgets</p>
      </div>

      {/* Budget Health */}
      <Card glow="purple">
        <div className="flex items-center gap-6">
          <ProgressArc value={budgetHealth} max={100} size={96} strokeWidth={8}>
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{budgetHealth}%</p>
              <p className="text-[10px] text-[var(--text-secondary)]">health</p>
            </div>
          </ProgressArc>
          <div>
            <p className="text-lg font-semibold text-[var(--text-primary)]">Budget health</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {budgetHealth >= 80 ? 'You\'re on track! Your spending is well within limits.' :
               budgetHealth >= 50 ? 'Some categories need attention.' :
               'Several budgets are being exceeded. Review your spending.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Budget Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.length > 0 ? budgets.map(budget => {
          const spent = spendingByCategory[budget.category] || 0;
          const limit = Number(budget.monthly_limit);
          const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
          const isExpanded = expandedBudget === budget.id;

          const status = percentage >= 100 ? 'danger' : percentage >= 80 ? 'warn' : 'ok';
          const statusLabel = percentage >= 100 ? 'Over budget' : percentage >= 80 ? 'Near limit' : 'On track';

          return (
            <Card
              key={budget.id}
              hover
              glow={status === 'danger' ? 'red' : status === 'warn' ? 'amber' : null}
              onClick={() => setExpandedBudget(isExpanded ? null : budget.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CATEGORY_ICONS[budget.category] || '📦'}</span>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] text-sm">{budget.category}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">{formatCurrency(spent)} / {formatCurrency(limit)}</p>
                  </div>
                </div>
                <Badge variant={status} size="sm" dot>{statusLabel}</Badge>
              </div>

              <ProgressArc
                value={spent}
                max={limit}
                size={80}
                strokeWidth={6}
                className="w-full justify-center my-2"
              >
                <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
                  {Math.round(percentage)}%
                </span>
              </ProgressArc>

              <ProgressBar value={spent} max={limit} height="h-2" className="mt-3" />

              {/* Expanded: AI Tip */}
              {isExpanded && (
                <div className="mt-4 pt-3 border-t border-[var(--border)] animate-on-mount">
                  <div className="flex gap-2">
                    <svg className="w-4 h-4 text-[var(--accent-purple)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-[var(--accent-purple)] mb-0.5">AI tip</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {percentage >= 80
                          ? `You're close to your ${budget.category} limit. Try reducing non-essential purchases.`
                          : `Great job staying under budget in ${budget.category}! Consider redirecting savings to a goal.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(budget.id); }}
                      className="text-xs font-medium text-[var(--accent-red)] hover:opacity-80 transition-opacity">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        }) : (
          <div className="sm:col-span-2 lg:col-span-3 flex flex-col items-center py-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 text-3xl">
              💰
            </div>
            <p className="text-lg font-medium text-[var(--text-primary)] mb-1">No budgets set</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Create your first budget to track spending</p>
            <Button onClick={openAddSheet}>Create Budget</Button>
          </div>
        )}
      </div>

      {/* FAB */}
      {budgets.length > 0 && (
        <button
          onClick={openAddSheet}
          className="fixed bottom-20 lg:bottom-8 right-6 z-40 w-14 h-14 rounded-2xl bg-[var(--accent-green)] text-[#0D0F14] shadow-[var(--shadow-glow-green)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Add budget"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Bottom Sheet */}
      <BottomSheet isOpen={showSheet} onClose={() => setShowSheet(false)} title="Add Budget">
        {formError && (
          <div className="mb-4 p-3 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 text-[var(--accent-red)] rounded-xl text-sm">{formError}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Category</p>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {availableCategories.length > 0 ? availableCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormData({...formData, category: cat})}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all ${
                    formData.category === cat
                      ? 'bg-[var(--accent-green)] text-[#0D0F14]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="text-lg">{CATEGORY_ICONS[cat] || '📦'}</span>
                  {cat}
                </button>
              )) : (
                <p className="col-span-3 text-sm text-[var(--text-secondary)] py-4 text-center">All categories already have budgets</p>
              )}
            </div>
          </div>

          <Input
            label="Monthly limit (R)"
            type="number"
            step="0.01"
            min="0"
            value={formData.monthly_limit}
            onChange={(e) => setFormData({...formData, monthly_limit: e.target.value})}
            placeholder="5000"
            required
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setShowSheet(false)}>
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={!formData.category || !formData.monthly_limit}>
              Set Budget
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}