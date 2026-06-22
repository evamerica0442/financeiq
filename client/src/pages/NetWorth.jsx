import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import api from '../api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function NetWorth() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', value: '', type: 'asset' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

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

  function openAddModal() {
    setEditingItem(null);
    setFormData({ name: '', value: '', type: 'asset' });
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setFormData({ name: item.name, value: Math.abs(item.value).toString(), type: item.type });
    setFormError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!formData.name || !formData.value) {
      setFormError('Name and value are required.');
      return;
    }

    const val = parseFloat(formData.value);
    if (isNaN(val) || val <= 0) {
      setFormError('Value must be a positive number.');
      return;
    }

    const value = formData.type === 'liability' ? -val : val;

    try {
      if (editingItem) {
        await api.put(`/networth/${editingItem.id}`, { name: formData.name, value, type: formData.type });
      } else {
        await api.post('/networth', { name: formData.name, value, type: formData.type });
      }
      setShowModal(false);
      fetchAssets();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save item.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this item?')) return;
    try {
      await api.delete(`/networth/${id}`);
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

  const formatCurrency = (amount) => {
    const prefix = amount < 0 ? '-' : '';
    return prefix + 'R' + Math.abs(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Mock monthly snapshots for the chart (in production, store historical data)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }));
  }

  // Generate realistic historical data based on current net worth
  const baseNetworth = netWorth;
  const monthlyData = months.map((_, i) => {
    const variation = (i / 5) * baseNetworth;
    const randomFactor = 0.95 + Math.random() * 0.1;
    return Math.round((variation + (baseNetworth - variation) * (i / 5)) * randomFactor);
  });

  const barChartData = {
    labels: months,
    datasets: [
      {
        label: 'Assets',
        data: monthlyData.map((v, i) => Math.round(v * (0.7 + i * 0.05))),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
      {
        label: 'Liabilities',
        data: monthlyData.map((v, i) => Math.round(v * (0.3 - i * 0.03))),
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1,
      },
    ]
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Net Worth Trend (6 Months)' }
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => 'R' + (value / 1000).toFixed(0) + 'k'
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Net Worth</h1>
          <p className="text-3xl font-bold mt-2 text-gray-900">
            {formatCurrency(netWorth)}
          </p>
          <p className="text-sm text-gray-500">
            Assets: {formatCurrency(totalAssets)} | Liabilities: {formatCurrency(totalLiabilities)}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="mt-3 sm:mt-0 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Item
        </button>
      </div>

      {/* Net Worth Trend Chart */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
        <Bar data={barChartData} options={barOptions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 bg-green-50 rounded-t-xl">
            <h2 className="text-lg font-semibold text-green-800">Assets</h2>
            <p className="text-sm text-green-600">Total: {formatCurrency(totalAssets)}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {assetItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No assets added yet</p>
            ) : (
              assetItems.map(item => (
                <div key={item.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">Asset</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(item.value)}</span>
                    <button onClick={() => openEditModal(item)} className="p-1 text-gray-400 hover:text-blue-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Liabilities */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 bg-red-50 rounded-t-xl">
            <h2 className="text-lg font-semibold text-red-800">Liabilities</h2>
            <p className="text-sm text-red-600">Total: {formatCurrency(totalLiabilities)}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {liabilityItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No liabilities added yet</p>
            ) : (
              liabilityItems.map(item => (
                <div key={item.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">Liability</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-semibold text-red-600">{formatCurrency(Math.abs(item.value))}</span>
                    <button onClick={() => openEditModal(item)} className="p-1 text-gray-400 hover:text-blue-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingItem ? 'Edit Item' : 'Add Asset/Liability'}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Property, Car Loan, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value (R)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="100000"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingItem ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}