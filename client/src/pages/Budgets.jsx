import React, { useState, useEffect } from 'react';
import api from '../api';
import AIBubble from '../components/AIBubble';

const CATEGORIES = ['Housing', 'Groceries', 'Transport', 'Dining out', 'Utilities', 'Subscriptions', 'Health', 'Entertainment', 'Education', 'Savings', 'Income', 'Other'];

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState({ category: '', monthly_limit: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

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

  // Calculate spending by category for current month
  const spendingByCategory = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category;
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(Number(t.amount));
  });

  function openAddModal() {
    setEditingBudget(null);
    setFormData({ category: '', monthly_limit: '' });
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(budget) {
    setEditingBudget(budget);
    setFormData({ category: budget.category, monthly_limit: budget.monthly_limit.toString() });
    setFormError('');
    setShowModal(true);
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
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save budget.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this budget category?')) return;
    try {
      await api.delete(`/budgets/${id}`);
      fetchData();
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  }

  const usedCategories = new Set(budgets.map(b => b.category));
  const availableCategories = CATEGORIES.filter(c => !usedCategories.has(c));

  const formatCurrency = (amount) => {
    return 'R' + Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <button
          onClick={openAddModal}
          className="mt-3 sm:mt-0 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          disabled={availableCategories.length === 0}
        >
          + Add Budget
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {budgets.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 mb-4">No budgets set yet. Create your first budget to track spending.</p>
              <button onClick={openAddModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Budget
              </button>
            </div>
          )}

          {budgets.map((budget) => {
            const spent = spendingByCategory[budget.category] || 0;
            const percentage = budget.monthly_limit > 0 ? Math.min((spent / Number(budget.monthly_limit)) * 100, 100) : 0;
            
            let barColor = 'bg-green-500';
            let progressColor = 'text-green-700';
            if (percentage >= 100) {
              barColor = 'bg-red-500';
              progressColor = 'text-red-700';
            } else if (percentage >= 80) {
              barColor = 'bg-yellow-500';
              progressColor = 'text-yellow-700';
            }

            return (
              <div key={budget.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{budget.category}</h3>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(spent)} spent of {formatCurrency(budget.monthly_limit)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-lg font-bold ${progressColor}`}>
                      {percentage.toFixed(0)}%
                    </span>
                    <button onClick={() => openEditModal(budget)} className="p-1 text-gray-400 hover:text-blue-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(budget.id)} className="p-1 text-gray-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                {percentage >= 80 && (
                  <p className="text-xs mt-2 text-red-600 font-medium">
                    {percentage >= 100 ? '⚠️ Budget exceeded!' : '⚡ Approaching budget limit'}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* AI Budget Tips */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-semibold text-gray-900">Budget Tips</h2>
          </div>
          <div className="space-y-3">
            <AIBubble
              title="Review Your Budget"
              body="Setting budgets for your top spending categories helps you stay on track."
              type="info"
            />
            {budgets.map(b => {
              const spent = spendingByCategory[b.category] || 0;
              const pct = b.monthly_limit > 0 ? (spent / Number(b.monthly_limit)) * 100 : 0;
              if (pct >= 80) {
                return (
                  <AIBubble
                    key={b.id}
                    title={`${b.category} Alert`}
                    body={`You've used ${pct.toFixed(0)}% of your ${b.category} budget. Consider reducing spending in this category.`}
                    type={pct >= 100 ? 'danger' : 'warn'}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingBudget ? 'Edit Budget' : 'Add Budget'}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={!editingBudget}
                >
                  <option value="">Select a category</option>
                  {(editingBudget ? [editingBudget.category] : availableCategories).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Limit (R)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthly_limit}
                  onChange={(e) => setFormData({...formData, monthly_limit: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="5000"
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
                  {editingBudget ? 'Update' : 'Add Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}