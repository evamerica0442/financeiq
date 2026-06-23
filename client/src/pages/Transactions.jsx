import React, { useState, useEffect } from 'react';
import api from '../api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import BottomSheet from '../components/ui/BottomSheet';
import AmountInput from '../components/ui/AmountInput';
import Skeleton, { TransactionListSkeleton } from '../components/ui/Skeleton';
import ImportModal from '../components/ImportModal';
import { useToast } from '../hooks/useToast';
import { useCategories } from '../hooks/useCategories';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  const [showFuture, setShowFuture] = useState(false);
  const { addToast } = useToast();
  const { categories, loading: catLoading, getCategoryIcon, getCategoryColor, groups, getCategoryGroup } = useCategories();

  const [showImport, setShowImport] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXls, setExportingXls] = useState(false);

  const [formData, setFormData] = useState({
    name: '', amount: '', category: '', category_id: null, date: new Date().toISOString().split('T')[0], notes: '', is_future: false
  });
  const [formError, setFormError] = useState('');

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const response = await api.get(`/reports/monthly/export?format=csv&month=${filterMonth}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions-${filterMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportXls = async () => {
    setExportingXls(true);
    try {
      const response = await api.get(`/reports/monthly/export?format=xls&month=${filterMonth}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/vnd.ms-excel' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions-${filterMonth}.xls`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export XLS', err);
    } finally {
      setExportingXls(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, [filterMonth, showFuture]);

  async function fetchTransactions() {
    try {
      const statusParam = showFuture ? 'future' : 'actual';
      const res = await api.get(`/transactions?month=${filterMonth}&status=${statusParam}`);
      setTransactions(res.data);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddSheet() {
    setEditingTx(null);
    const firstCat = categories.length > 0 ? categories[0] : null;
    setFormData({
      name: '', amount: '', category: firstCat?.name || 'Other',
      category_id: firstCat?.id || null,
      date: new Date().toISOString().split('T')[0], notes: '', is_future: false
    });
    setFormError('');
    setShowSheet(true);
  }

  function openEditSheet(tx) {
    setEditingTx(tx);
    setFormData({
      name: tx.name,
      amount: tx.amount.toString(),
      category: tx.category,
      category_id: tx.category_id,
      date: tx.date,
      notes: tx.notes || '',
      is_future: tx.is_future || false,
    });
    setFormError('');
    setShowSheet(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!formData.name || !formData.amount) {
      setFormError('Name and amount are required.');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount)) {
      setFormError('Amount must be a valid number.');
      return;
    }

    const payload = {
      name: formData.name,
      amount,
      category: formData.category,
      date: formData.date,
      notes: formData.notes || null,
      is_future: formData.is_future,
    };

    try {
      if (editingTx) {
        await api.put(`/transactions/${editingTx.id}`, payload);
        addToast('Transaction updated', 'success');
      } else {
        await api.post('/transactions', payload);
        addToast(formData.is_future ? 'Future transaction added' : 'Transaction added', 'success');
      }
      setShowSheet(false);
      fetchTransactions();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save transaction.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/transactions/${id}`);
      addToast('Transaction deleted', 'info');
      fetchTransactions();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  }

  async function handleMoveToActual(tx) {
    try {
      await api.post(`/transactions/move-to-actual/${tx.id}`, { date: new Date().toISOString().split('T')[0] });
      addToast('Transaction moved to actual', 'success');
      fetchTransactions();
    } catch (err) {
      addToast('Failed to move transaction', 'error');
    }
  }

  const filtered = transactions.filter(t => {
    if (filterCategory && t.category !== filterCategory) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Group by date
  const grouped = {};
  filtered.forEach(t => {
    const dateKey = t.date;
    if (!grouped[dateKey]) grouped[dateKey] = { transactions: [], total: 0 };
    grouped[dateKey].transactions.push(t);
    grouped[dateKey].total += Number(t.amount);
  });

  const monthlyTotal = filtered.reduce((sum, t) => sum + Number(t.amount), 0);
  const formatCurrency = (amount) => 'R' + Math.abs(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Helper: get icon/color from the API-returned joined data or fallback to context
  const getIcon = (tx) => tx.category_icon || getCategoryIcon(tx.category) || '📦';
  const getColor = (tx) => tx.category_color || getCategoryColor(tx.category) || '#8B92A5';

  if (loading || catLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <Skeleton variant="title" className="mb-6" />
        <TransactionListSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-on-mount">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Transactions</h1>
          <p className="text-sm text-[var(--text-secondary)]">{filtered.length} transactions this month</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Future toggle */}
          <button
            onClick={() => setShowFuture(!showFuture)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
              showFuture
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title={showFuture ? 'Showing future transactions' : 'Show future transactions'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">{showFuture ? 'Actual' : 'Future'}</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              opacity: exportingCsv ? 0.6 : 1,
            }}
            title="Export as CSV"
          >
            {exportingCsv ? (
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* Export XLS */}
          <button
            onClick={handleExportXls}
            disabled={exportingXls}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: 'var(--accent-green)',
              color: '#0D0F14',
              opacity: exportingXls ? 0.6 : 1,
            }}
            title="Export as Excel"
          >
            {exportingXls ? (
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0D0F14', borderTopColor: 'transparent' }} />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <span className="hidden sm:inline">XLS</span>
          </button>

          {/* Import */}
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: 'var(--accent-green)',
              color: '#0D0F14',
            }}
            title="Import transactions from file"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            const d = new Date(filterMonth + '-01');
            d.setMonth(d.getMonth() - 1);
            setFilterMonth(d.toISOString().slice(0, 7));
          }}
          className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          aria-label="Previous month"
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
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transactions..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border-2 border-transparent focus:border-[var(--accent-green)] text-[var(--text-primary)] text-sm outline-none transition-colors placeholder:text-[var(--text-secondary)] placeholder:opacity-50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        <button
          onClick={() => setFilterCategory('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            !filterCategory ? 'bg-[var(--accent-green)] text-[#0D0F14]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.name}
            onClick={() => setFilterCategory(cat.name === filterCategory ? '' : cat.name)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === cat.name ? 'bg-[var(--accent-green)] text-[#0D0F14]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {cat.icon || '📦'} {cat.name}
          </button>
        ))}
      </div>

      {/* Monthly Total */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Monthly total</span>
          <span className={`text-xl font-bold tabular-nums ${monthlyTotal >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
            {monthlyTotal >= 0 ? '+' : '-'}{formatCurrency(monthlyTotal)}
          </span>
        </div>
      </Card>

      {/* Transaction List */}
      <div className="space-y-6">
        {Object.entries(grouped).length > 0 ? Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([dateKey, group]) => (
          <div key={dateKey}>
            <div className="sticky top-0 z-10 bg-[var(--bg-primary)] py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {formatDate(dateKey)}
                </span>
                <span className={`text-xs font-medium tabular-nums ${group.total >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                  {group.total >= 0 ? '+' : ''}{formatCurrency(group.total)}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              {group.transactions.map((tx, i) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors group"
                  style={{ animation: `fadeInUp 300ms ease-out ${i * 30}ms both` }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                    style={{ backgroundColor: (getColor(tx) || '#8B92A5') + '20' }}
                  >
                    {getIcon(tx) || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{tx.name}</p>
                      {tx.is_future && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 leading-none">
                          Future
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {tx.group_name ? `${tx.group_name} › ` : ''}{tx.category}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${tx.amount > 0 ? 'text-[var(--accent-green)]' : 'text-[var(--text-primary)]'}`}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {tx.is_future && (
                      <button
                        onClick={() => handleMoveToActual(tx)}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-green)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        aria-label="Move to actual"
                        title="Move to actual transactions"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => openEditSheet(tx)}
                      className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      aria-label="Edit transaction"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      aria-label="Delete transaction"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 text-3xl">
              {showFuture ? '⏰' : '📭'}
            </div>
            <p className="text-lg font-medium text-[var(--text-primary)] mb-1">
              {showFuture ? 'No upcoming transactions' : 'No transactions found'}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {searchQuery ? 'Try a different search term' : showFuture ? 'Add a future transaction to track upcoming expenses' : 'Add your first transaction to get started'}
            </p>
            <Button onClick={openAddSheet}>{showFuture ? 'Add future transaction' : 'Add transaction'}</Button>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={openAddSheet}
        className="fixed bottom-20 lg:bottom-8 right-6 z-40 w-14 h-14 rounded-2xl bg-[var(--accent-green)] text-[#0D0F14] shadow-[var(--shadow-glow-green)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label="Add transaction"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Bottom Sheet */}
      <BottomSheet isOpen={showSheet} onClose={() => setShowSheet(false)} title={editingTx ? 'Edit Transaction' : 'Add Transaction'}>
        {formError && (
          <div className="mb-4 p-3 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 text-[var(--accent-red)] rounded-xl text-sm">{formError}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Transaction name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Grocery store"
            required
          />

          <AmountInput
            label="Amount (negative for expense)"
            value={formData.amount}
            onChange={(v) => setFormData({...formData, amount: v})}
            placeholder="0.00"
            required
          />

          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Category</p>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {groups.map(group => (
                <div key={group.id} className="w-full">
                  <p className="text-xs text-[var(--text-secondary)] mb-1 px-1">{group.icon} {group.name}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {group.categories?.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFormData({...formData, category: cat.name, category_id: cat.id})}
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
              ))}
            </div>
          </div>

          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
          />

          <Input
            label="Notes (optional)"
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            placeholder="Any additional details"
          />

          {/* Future toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_future}
                onChange={(e) => setFormData({...formData, is_future: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-10 h-6 rounded-full bg-[var(--bg-tertiary)] peer-checked:bg-[var(--accent-blue)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
            </label>
            <span className="text-sm text-[var(--text-secondary)]">{formData.is_future ? 'Future transaction' : 'Actual transaction'}</span>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setShowSheet(false)}>
              Cancel
            </Button>
            <Button type="submit" fullWidth>
              {editingTx ? 'Update' : formData.is_future ? 'Add Future' : 'Add Transaction'}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => fetchTransactions()}
      />
    </div>
  );
}