import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import api from '../api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import BottomSheet from '../components/ui/BottomSheet';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../hooks/useToast';
import { useCategories } from '../hooks/useCategories';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend);

const ASSET_TYPE_OPTIONS = [
  { value: 'cash', label: 'Cash & Savings', icon: '🏦' },
  { value: 'savings', label: 'Savings Account', icon: '💰' },
  { value: 'investment', label: 'Investment', icon: '📈' },
  { value: 'property', label: 'Property', icon: '🏠' },
  { value: 'vehicle', label: 'Vehicle', icon: '🚗' },
  { value: 'other', label: 'Other', icon: '📦' },
];

const LIABILITY_TYPE_OPTIONS = [
  { value: 'home_loan', label: 'Home Loan', icon: '🏠' },
  { value: 'vehicle_finance', label: 'Vehicle Finance', icon: '🚗' },
  { value: 'personal_loan', label: 'Personal Loan', icon: '💳' },
  { value: 'credit_card', label: 'Credit Card', icon: '💳' },
  { value: 'store_account', label: 'Store Account', icon: '🛍️' },
  { value: 'other', label: 'Other', icon: '📦' },
];

const ASSET_ICONS = {
  cash: '🏦', savings: '💰', investment: '📈',
  property: '🏠', vehicle: '🚗', other: '📦',
  home_loan: '🏠', vehicle_finance: '🚗', personal_loan: '💳',
  credit_card: '💳', store_account: '🛍️',
};

export default function NetWorth() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '', value: '', type: 'asset', asset_type: 'other',
    depreciation_rate: '', linked_category: '', notes: '',
  });
  const [formError, setFormError] = useState('');
  const [history, setHistory] = useState([]);
  const [insights, setInsights] = useState(null);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const { addToast } = useToast();
  const { categories, loading: catLoading } = useCategories();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [assetsRes, historyRes, insightsRes] = await Promise.all([
        api.get('/networth'),
        api.get('/networth/history?months=12').catch(() => ({ data: [] })),
        api.get('/networth/insights').catch(() => null),
      ]);
      setAssets(assetsRes.data);
      setHistory(historyRes.data);
      setInsights(insightsRes?.data || null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddSheet(type = 'asset') {
    setEditingItem(null);
    setFormData({
      name: '', value: '', type,
      asset_type: type === 'liability' ? 'personal_loan' : 'other',
      depreciation_rate: '', linked_category: '', notes: '',
    });
    setFormError('');
    setShowSheet(true);
  }

  function openEditSheet(item) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      value: Math.abs(item.value).toString(),
      type: item.type,
      asset_type: item.asset_type || 'other',
      depreciation_rate: item.depreciation_rate ? item.depreciation_rate.toString() : '',
      linked_category: item.linked_category || '',
      notes: item.notes || '',
    });
    setFormError('');
    setShowSheet(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!formData.name || !formData.value) { setFormError('Name and value are required.'); return; }
    const val = parseFloat(formData.value);
    if (isNaN(val) || val <= 0) { setFormError('Value must be a positive number.'); return; }
    const value = formData.type === 'liability' ? -val : val;
    const body = {
      name: formData.name,
      value,
      type: formData.type,
      asset_type: formData.asset_type,
      depreciation_rate: formData.depreciation_rate ? parseFloat(formData.depreciation_rate) : 0,
      linked_category: formData.linked_category || null,
      notes: formData.notes || null,
    };

    try {
      if (editingItem) {
        await api.put(`/networth/${editingItem.id}`, body);
        addToast('Item updated', 'success');
      } else {
        await api.post('/networth', body);
        addToast('Item added', 'success');
      }
      setShowSheet(false);
      fetchAll();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save item.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/networth/${id}`);
      addToast('Item deleted', 'info');
      setDeleteConfirm(null);
      fetchAll();
    } catch (err) {
      console.error('Failed to delete:', err);
      addToast('Failed to delete item', 'error');
    }
  }

  async function handleTakeSnapshot() {
    setSnapshotting(true);
    try {
      const res = await api.post('/networth/snapshot');
      setAutomationStatus(prev => ({
        ...prev,
        lastSnapshot: new Date().toISOString(),
        lastSnapshotValue: res.data.net_worth,
      }));
      addToast('Snapshot taken successfully', 'success');
      fetchAll();
    } catch (err) {
      addToast('Failed to take snapshot', 'error');
    } finally {
      setSnapshotting(false);
    }
  }

  async function handleSyncTransactions() {
    setSyncing(true);
    try {
      const res = await api.post('/networth/sync');
      addToast(`Synced ${res.data.count} linked asset(s)`, res.data.count > 0 ? 'success' : 'info');
      if (res.data.count > 0) fetchAll();
    } catch (err) {
      addToast('Failed to sync transactions', 'error');
    } finally {
      setSyncing(false);
    }
  }

  const assetItems = assets.filter(a => a.type === 'asset');
  const liabilityItems = assets.filter(a => a.type === 'liability');
  const totalAssets = assetItems.reduce((sum, a) => sum + Number(a.value), 0);
  const totalLiabilities = liabilityItems.reduce((sum, a) => sum + Math.abs(Number(a.value)), 0);
  const netWorth = totalAssets - totalLiabilities;

  const maxValue = Math.max(totalAssets, totalLiabilities, 1);

  // Chart data from API history
  const chartLabels = history.length > 0
    ? history.map(h => {
        if (!h.date) return '';
        const d = new Date(h.date);
        return d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      })
    : [];

  const chartNetWorthData = history.length > 0
    ? history.map(h => Number(h.net_worth))
    : [];

  const chartData = {
    labels: chartLabels,
    datasets: [{
      label: 'Net Worth',
      data: chartNetWorthData,
      fill: true,
      backgroundColor: (ctx) => {
        if (!ctx.chart?.ctx) return 'rgba(0, 200, 150, 0.1)';
        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(0, 200, 150, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 200, 150, 0)');
        return gradient;
      },
      borderColor: '#00C896',
      borderWidth: 2,
      pointBackgroundColor: '#00C896',
      pointBorderColor: '#161A23',
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.4,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
          label: (ctx) => 'R' + ctx.parsed.y.toLocaleString('en-ZA')
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: 'var(--text-secondary)', font: { size: 11, family: 'Inter' }, maxTicksLimit: 8 } },
      y: {
        grid: { color: 'rgba(139, 146, 165, 0.1)', drawBorder: false },
        ticks: {
          color: 'var(--text-secondary)',
          font: { size: 11, family: 'Inter' },
          callback: (value) => 'R' + (value / 1000).toFixed(0) + 'k',
        }
      }
    },
    interaction: { intersect: false, mode: 'index' },
  };

  const formatCurrency = (amount) => {
    const prefix = amount < 0 ? '-' : '';
    return prefix + 'R' + Math.abs(amount).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  const categoryOptions = categories.filter(c => c.type === 'income' || c.type === 'transfer').map(c => c.name);
  const uniqueCategories = [...new Set(categoryOptions)];

  if (loading || catLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <Skeleton variant="title" className="mb-6" />
        <Skeleton variant="card" height="140px" className="mb-6" />
        <Skeleton variant="chart" height="250px" className="mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton variant="card" height="300px" />
          <Skeleton variant="card" height="300px" />
        </div>
        <Skeleton variant="card" height="80px" className="mt-6" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
      {/* Hero Banner */}
      <div className="animate-on-mount">
        <Card gradient className="border-transparent relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--accent-green)]/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Net Worth</p>
            <p className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] tracking-tight tabular-nums mt-1">
              {formatCurrency(netWorth)}
            </p>
            {insights && (
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                  insights.trend === 'up' ? 'text-[var(--accent-green)]' :
                  insights.trend === 'down' ? 'text-[var(--accent-red)]' : 'text-[var(--text-secondary)]'
                }`}>
                  <svg className={`w-4 h-4 ${insights.trend === 'down' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  {insights.change >= 0 ? '+' : ''}R{Math.abs(insights.change).toLocaleString()} this month ({insights.changePercent}%)
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  Projected in 12 months: {formatCurrency(insights.projectedNetWorth12Months)}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-4">
              <Badge variant="ok" dot>Assets: {formatCurrency(totalAssets)}</Badge>
              <Badge variant="danger" dot>Liabilities: {formatCurrency(totalLiabilities)}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Net Worth Chart */}
      <Card padding={false}>
        <div className="p-5 sm:p-6 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Net worth over time</h3>
          {chartLabels.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">Add assets and take a snapshot to start tracking your net worth over time</p>
          )}
        </div>
        <div className="px-5 sm:px-6 pb-6 pt-2" style={{ height: '280px' }}>
          {chartLabels.length > 0 ? (
            <Line data={chartData} options={chartOptions} key={history.length} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
              <div className="text-center">
                <p className="text-3xl mb-2">📊</p>
                <p>Chart will appear once you have snapshots</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Assets & Liabilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <Card padding={false}>
          <div className="p-5 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--accent-green)]">Assets</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{formatCurrency(totalAssets)} total</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openAddSheet('asset')}
                  className="w-8 h-8 rounded-lg bg-[var(--accent-green)]/10 flex items-center justify-center hover:bg-[var(--accent-green)]/20 transition-colors"
                  title="Add asset"
                >
                  <svg className="w-4 h-4 text-[var(--accent-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {assetItems.length > 0 ? assetItems.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-tertiary)] transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{ASSET_ICONS[item.asset_type] || '📦'}</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{item.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {item.asset_type === 'vehicle' && Number(item.depreciation_rate) > 0 && (
                          <Badge variant="warn" size="xs">{item.depreciation_rate}% p.a. auto-depreciation</Badge>
                        )}
                        {item.linked_category && (
                          <Badge variant="info" size="xs">Auto-synced with {item.linked_category}</Badge>
                        )}
                        {item.last_auto_updated && (
                          <span className="text-[10px] text-[var(--text-secondary)]">Updated {formatDate(item.last_auto_updated)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-2 max-w-[200px]">
                    <div className="h-full rounded-full bg-[var(--accent-green)]" style={{ width: `${(Number(item.value) / maxValue) * 100}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-sm font-semibold text-[var(--accent-green)] tabular-nums">{formatCurrency(item.value)}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditSheet(item)} className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-tertiary)]" aria-label="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => setDeleteConfirm(item)} className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-tertiary)]" aria-label="Delete">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-center py-8 text-sm text-[var(--text-secondary)]">
                No assets added yet
                <br />
                <button onClick={() => openAddSheet('asset')} className="text-[var(--accent-green)] font-medium mt-1 hover:underline">Add your first asset</button>
              </p>
            )}
          </div>
        </Card>

        {/* Liabilities */}
        <Card padding={false}>
          <div className="p-5 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--accent-red)]">Liabilities</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{formatCurrency(totalLiabilities)} total</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openAddSheet('liability')}
                  className="w-8 h-8 rounded-lg bg-[var(--accent-red)]/10 flex items-center justify-center hover:bg-[var(--accent-red)]/20 transition-colors"
                  title="Add liability"
                >
                  <svg className="w-4 h-4 text-[var(--accent-red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {liabilityItems.length > 0 ? liabilityItems.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-tertiary)] transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{ASSET_ICONS[item.asset_type] || '💳'}</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{item.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {item.asset_type && (
                          <Badge variant="danger" size="xs">
                            {LIABILITY_TYPE_OPTIONS.find(o => o.value === item.asset_type)?.label || item.asset_type}
                          </Badge>
                        )}
                        <Badge variant="info" size="xs">Auto-reduce on repayment</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-2 max-w-[200px]">
                    <div className="h-full rounded-full bg-[var(--accent-red)]" style={{ width: `${(Math.abs(Number(item.value)) / maxValue) * 100}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-sm font-semibold text-[var(--accent-red)] tabular-nums">{formatCurrency(Math.abs(item.value))}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditSheet(item)} className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-tertiary)]" aria-label="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => setDeleteConfirm(item)} className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-tertiary)]" aria-label="Delete">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-center py-8 text-sm text-[var(--text-secondary)]">
                No liabilities added yet
                <br />
                <button onClick={() => openAddSheet('liability')} className="text-[var(--accent-red)] font-medium mt-1 hover:underline">Add your first liability</button>
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Automation Status Panel */}
      <Card padding={false}>
        <div className="p-5 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">⚙️ Automation</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium">Last snapshot</p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                {insights?.lastMonthNetWorth ? formatDate(new Date().toISOString()) : 'No snapshots yet'}
              </p>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium">Next snapshot</p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium">Linked assets</p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                {assetItems.filter(a => a.linked_category).length} auto-synced
              </p>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium">Depreciating vehicles</p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                {assetItems.filter(a => a.asset_type === 'vehicle' && Number(a.depreciation_rate) > 0).length} active
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTakeSnapshot}
              disabled={snapshotting}
            >
              {snapshotting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" />
                  Taking snapshot...
                </span>
              ) : 'Take snapshot now'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncTransactions}
              disabled={syncing}
            >
              {syncing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" />
                  Syncing...
                </span>
              ) : 'Sync transactions'}
            </Button>
          </div>
        </div>
      </Card>

      {/* FAB — only show on mobile */}
      <div className="fixed bottom-20 lg:bottom-8 right-6 z-40 flex flex-col gap-2">
        <button
          onClick={() => openAddSheet('liability')}
          className="w-12 h-12 rounded-2xl bg-[var(--accent-red)] text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Add liability"
          title="Add liability"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={() => openAddSheet('asset')}
          className="w-14 h-14 rounded-2xl bg-[var(--accent-green)] text-[#0D0F14] shadow-[var(--shadow-glow-green)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Add asset"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 max-w-sm w-full border border-[var(--border)] shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Delete {deleteConfirm.name}?</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2">This action cannot be undone. This will permanently delete this item.</p>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" fullWidth onClick={() => handleDelete(deleteConfirm.id)}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet */}
      <BottomSheet isOpen={showSheet} onClose={() => setShowSheet(false)} title={editingItem ? 'Edit Item' : 'Add Item'}>
        {formError && <div className="mb-4 p-3 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 text-[var(--accent-red)] rounded-xl text-sm">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder={formData.type === 'asset' ? 'Property, Vehicle, Savings...' : 'Home Loan, Credit Card...'}
            required
          />

          {/* Type selector */}
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-1.5">Type</p>
            <div className="flex gap-2">
              {['asset', 'liability'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({...formData, type, asset_type: type === 'liability' ? 'personal_loan' : 'other'})}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    formData.type === type
                      ? type === 'asset' ? 'bg-[var(--accent-green)]/10 text-[var(--accent-green)] border border-[var(--accent-green)]/20' : 'bg-[var(--accent-red)]/10 text-[var(--accent-red)] border border-[var(--accent-red)]/20'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-transparent'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Asset type / Liability type */}
          {formData.type === 'asset' ? (
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-1.5">Asset type</p>
              <div className="grid grid-cols-2 gap-2">
                {ASSET_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({...formData, asset_type: opt.value})}
                    className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                      formData.asset_type === opt.value
                        ? 'bg-[var(--accent-green)]/10 text-[var(--accent-green)] border border-[var(--accent-green)]/20'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-tertiary)]/80'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-1.5">Liability type</p>
              <div className="grid grid-cols-2 gap-2">
                {LIABILITY_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({...formData, asset_type: opt.value})}
                    className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                      formData.asset_type === opt.value
                        ? 'bg-[var(--accent-red)]/10 text-[var(--accent-red)] border border-[var(--accent-red)]/20'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-tertiary)]/80'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            label="Value (R)"
            type="number"
            step="0.01"
            min="0"
            value={formData.value}
            onChange={(e) => setFormData({...formData, value: e.target.value})}
            placeholder="100000"
            required
            prefix="R"
          />

          {/* Depreciation rate (only for vehicles) */}
          {formData.type === 'asset' && formData.asset_type === 'vehicle' && (
            <div className="p-3 rounded-xl bg-[var(--accent-red)]/5 border border-[var(--accent-red)]/10">
              <Input
                label="Depreciation Rate (% per year)"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.depreciation_rate}
                onChange={(e) => setFormData({...formData, depreciation_rate: e.target.value})}
                placeholder="15"
                suffix="%"
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">Typical SA vehicle depreciation is 10–20% per year</p>
            </div>
          )}

          {/* Link to category (only for assets) */}
          {formData.type === 'asset' && (
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Link to transaction category <span className="text-[var(--text-secondary)]/60">(optional)</span>
              </p>
              <select
                value={formData.linked_category}
                onChange={(e) => setFormData({...formData, linked_category: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-green)] transition-colors"
              >
                <option value="">None — no auto-sync</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <p className="text-xs text-[var(--text-secondary)] mt-1">When linked, this asset's value auto-syncs with transactions in this category</p>
            </div>
          )}

          {/* Auto-reduce on repayment toggle (for liabilities) */}
          {formData.type === 'liability' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)]">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center text-lg">🔄</div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Auto-reduce on repayment</p>
                <p className="text-xs text-[var(--text-secondary)]">Automatically reduce this balance when a matching transaction is detected</p>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Notes <span className="text-[var(--text-secondary)]/60">(optional)</span>
            </p>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Any additional details..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-green)] transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setShowSheet(false)}>Cancel</Button>
            <Button type="submit" fullWidth>{editingItem ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}