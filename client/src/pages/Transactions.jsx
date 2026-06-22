import React, { useState, useEffect } from 'react';
import api from '../api';
import TransactionRow from '../components/TransactionRow';

const CATEGORIES = ['Housing', 'Groceries', 'Transport', 'Dining out', 'Utilities', 'Subscriptions', 'Health', 'Entertainment', 'Education', 'Savings', 'Income', 'Other'];

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: 'Groceries',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [filterMonth]);

  async function fetchTransactions() {
    try {
      const res = await api.get(`/transactions?month=${filterMonth}`);
      setTransactions(res.data);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingTx(null);
    setFormData({
      name: '',
      amount: '',
      category: 'Groceries',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(tx) {
    setEditingTx(tx);
    setFormData({
      name: tx.name,
      amount: tx.amount.toString(),
      category: tx.category,
      date: tx.date,
      notes: tx.notes || ''
    });
    setFormError('');
    setShowModal(true);
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
      amount: amount,
      category: formData.category,
      date: formData.date,
      notes: formData.notes || null
    };

    try {
      if (editingTx) {
        await api.put(`/transactions/${editingTx.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      setShowModal(false);
      fetchTransactions();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save transaction.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      fetchTransactions();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  }

  const filtered = filterCategory
    ? transactions.filter(t => t.category === filterCategory)
    : transactions;

  const monthlyTotal = filtered.reduce((sum, t) => sum + Number(t.amount), 0);
  const formatCurrency = (amount) => {
    return 'R' + Math.abs(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <button
          onClick={openAddModal}
          className="mt-3 sm:mt-0 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <span>+</span>
          <span>Add Transaction</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly Total */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600 font-medium">Monthly Total</span>
          <span className={`text-xl font-bold ${monthlyTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {monthlyTotal >= 0 ? '+' : '-'}{formatCurrency(monthlyTotal)}
          </span>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="divide-y divide-gray-100">
          {filtered.map((tx) => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No transactions found</p>
              <button onClick={openAddModal} className="mt-2 text-blue-600 hover:text-blue-700 font-medium">
                Add your first transaction
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingTx ? 'Edit Transaction' : 'Add Transaction'}
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
                  placeholder="Transaction name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-gray-500">(negative for expense)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="-1000 for expense, 5000 for income"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                  placeholder="Optional notes"
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
                  {editingTx ? 'Update' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}