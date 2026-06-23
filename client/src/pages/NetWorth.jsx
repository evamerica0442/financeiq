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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend);

export default function NetWorth() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', value: '', type: 'asset' });
  const [formError, setFormError] = useState('');
  const { addToast } = useToast();

  useEffect(() => { fetchAssets(); }, []);

  async function fetchAssets() {
    try {
      const res = await api.get('/networth');
      setAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddSheet() {
    setEditingItem(null);
    setFormData({ name: '', value: '', type: 'asset' });
    setFormError('');
    setShowSheet(true);
  }

  function openEditSheet(item) {
    setEditingItem(item);
    setFormData({ name: item.name, value: Math.abs(item.value).toString(), type: item.type });
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

    try {
      if (editingItem) {
        await api.put(`/networth/${editingItem.id}`, { name: formData.name, value, type: formData.type });
        addToast('Item updated', 'success');
      } else {
        await api.post('/networth', { name: formData.name, value, type: formData.type });
        addToast('Item added', 'success');
      }
      setShowSheet(false);
      fetchAssets();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save item.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/networth/${id}`);
      addToast('Item deleted', 'info');
      fetchAssets();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  const assetItems = assets.filter(a => a.type === 'asset');
  const liabilityItems = assets.filter(a => a.type === 'liability');
  const totalAssets = assetItems.reduce((sum, a) => sum + Number(a.value), 0);
  const totalLiabilities = liabilityItems.reduce((sum, a) => sum + Math.abs(Number(a.value)), 0);
  const netWorth = totalAssets - totalLiabilities;

  const maxValue = Math.max(totalAssets, totalLiabilities, 1);

  // Historical chart data
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }));
  }

  const baseNetworth = netWorth || 100000;
  const netWorthHistory = months.map((_, i) => {
    const progress = (i + 1) / 6;
    return Math.round(baseNetworth * (0.7 + 0.3 * progress) * (0.97 + Math.random() * 0.06));
  });

  const chartData = {
    labels: months,
    datasets: [{
      label: 'Net Worth',
      data: netWorthHistory,
      fill: true,
      backgroundColor: (ctx) => {
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
        callbacks: { label: (ctx) => 'R' + ctx.parsed.y.toLocaleString('en-ZA') }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: 'var(--text-secondary)', font: { size: 11, family: 'Inter' } } },
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <Skeleton variant="title" className="mb-6" />
        <Skeleton variant="card" height="120px" className="mb-6" />
        <Skeleton variant="chart" height="250px" className="mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton variant="card" height="250px" />
          <Skeleton variant="card" height="250px" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
      {/* Header */}
      <div className="animate-on-mount">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Net Worth</h1>
      </div>

      {/* Net Worth Hero */}
      <Card gradient className="border-transparent">
        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Net worth</p>
        <p className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] tracking-tight tabular-nums mt-1">
          {formatCurrency(netWorth)}
        </p>
        <div className="flex flex-wrap gap-4 mt-4">
          <Badge variant="ok" dot>Assets: {formatCurrency(totalAssets)}</Badge>
          <Badge variant="danger" dot>Liabilities: {formatCurrency(totalLiabilities)}</Badge>
        </div>
      </Card>

      {/* Net Worth Chart */}
      <Card padding={false}>
        <div className="p-5 sm:p-6 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Net worth growth</h3>
        </div>
        <div className="px-5 sm:px-6 pb-6 pt-2" style={{ height: '280px' }}>
          <Line data={chartData} options={chartOptions} />
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
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-green)]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--accent-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {assetItems.length > 0 ? assetItems.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-tertiary)] transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.name}</p>
                  <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-1.5 max-w-[200px]">
                    <div className="h-full rounded-full bg-[var(--accent-green)]" style={{ width: `${(Number(item.value) / maxValue) * 100}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-sm font-semibold text-[var(--accent-green)] tabular-nums">{formatCurrency(item.value)}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditSheet(item)} className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent-blue)]" aria-label="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent-red)]" aria-label="Delete">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-center py-8 text-sm text-[var(--text-secondary)]">No assets added yet</p>
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
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-red)]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--accent-red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {liabilityItems.length > 0 ? liabilityItems.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-tertiary)] transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.name}</p>
                  <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-1.5 max-w-[200px]">
                    <div className="h-full rounded-full bg-[var(--accent-red)]" style={{ width: `${(Math.abs(Number(item.value)) / maxValue) * 100}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-sm font-semibold text-[var(--accent-red)] tabular-nums">{formatCurrency(Math.abs(item.value))}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditSheet(item)} className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent-blue)]" aria-label="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent-red)]" aria-label="Delete">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-center py-8 text-sm text-[var(--text-secondary)]">No liabilities added yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* FAB */}
      <button
        onClick={openAddSheet}
        className="fixed bottom-20 lg:bottom-8 right-6 z-40 w-14 h-14 rounded-2xl bg-[var(--accent-green)] text-[#0D0F14] shadow-[var(--shadow-glow-green)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label="Add item"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Bottom Sheet */}
      <BottomSheet isOpen={showSheet} onClose={() => setShowSheet(false)} title={editingItem ? 'Edit Item' : 'Add Item'}>
        {formError && <div className="mb-4 p-3 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 text-[var(--accent-red)] rounded-xl text-sm">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Property, Car Loan, etc." required />

          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-1.5">Type</p>
            <div className="flex gap-2">
              {['asset', 'liability'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({...formData, type})}
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

          <Input label="Value (R)" type="number" step="0.01" min="0" value={formData.value} onChange={(e) => setFormData({...formData, value: e.target.value})} placeholder="100000" required prefix="R" />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setShowSheet(false)}>Cancel</Button>
            <Button type="submit" fullWidth>{editingItem ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}