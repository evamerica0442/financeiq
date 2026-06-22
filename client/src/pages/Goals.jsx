import React, { useState, useEffect } from 'react';
import api from '../api';
import GoalRow from '../components/GoalRow';
import AIBubble from '../components/AIBubble';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositGoal, setDepositGoal] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    saved_amount: '0',
    monthly_contribution: '0',
    target_date: ''
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchGoals();
  }, []);

  async function fetchGoals() {
    try {
      const res = await api.get('/goals');
      setGoals(res.data);
    } catch (err) {
      console.error('Failed to fetch goals:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingGoal(null);
    setFormData({
      name: '',
      target_amount: '',
      saved_amount: '0',
      monthly_contribution: '0',
      target_date: ''
    });
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(goal) {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      saved_amount: goal.saved_amount.toString(),
      monthly_contribution: goal.monthly_contribution.toString(),
      target_date: goal.target_date || ''
    });
    setFormError('');
    setShowModal(true);
  }

  function openDepositModal(goal) {
    setDepositGoal(goal);
    setDepositAmount('');
    setShowDepositModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!formData.name || !formData.target_amount) {
      setFormError('Name and target amount are required.');
      return;
    }

    const target = parseFloat(formData.target_amount);
    const saved = parseFloat(formData.saved_amount) || 0;
    const contribution = parseFloat(formData.monthly_contribution) || 0;

    if (isNaN(target) || target <= 0) {
      setFormError('Target amount must be a positive number.');
      return;
    }

    try {
      if (editingGoal) {
        await api.put(`/goals/${editingGoal.id}`, {
          name: formData.name,
          target_amount: target,
          saved_amount: saved,
          monthly_contribution: contribution,
          target_date: formData.target_date || null
        });
      } else {
        await api.post('/goals', {
          name: formData.name,
          target_amount: target,
          saved_amount: saved,
          monthly_contribution: contribution,
          target_date: formData.target_date || null
        });
      }
      setShowModal(false);
      fetchGoals();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save goal.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api.delete(`/goals/${id}`);
      fetchGoals();
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  }

  async function handleDeposit(e) {
    e.preventDefault();
    if (!depositGoal || !depositAmount) return;

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid deposit amount.');
      return;
    }

    const newSaved = Number(depositGoal.saved_amount) + amount;
    try {
      await api.put(`/goals/${depositGoal.id}`, {
        name: depositGoal.name,
        target_amount: depositGoal.target_amount,
        saved_amount: newSaved,
        monthly_contribution: depositGoal.monthly_contribution,
        target_date: depositGoal.target_date
      });
      setShowDepositModal(false);
      fetchGoals();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to log deposit.');
    }
  }

  const formatCurrency = (amount) => {
    return 'R' + Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // AI projections for goals
  const goalProjections = goals.map(goal => {
    const remaining = Number(goal.target_amount) - Number(goal.saved_amount);
    const monthsLeft = goal.monthly_contribution > 0 ? Math.ceil(remaining / Number(goal.monthly_contribution)) : null;
    return { ...goal, remaining, monthsLeft };
  });

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
        <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
        <button
          onClick={openAddModal}
          className="mt-3 sm:mt-0 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Goal
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {goals.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 mb-4">No goals set yet. Create your first financial goal!</p>
              <button onClick={openAddModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Goal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map(goal => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onDeposit={openDepositModal}
                />
              ))}
            </div>
          )}
        </div>

        {/* AI Goal Projections */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-semibold text-gray-900">Projections</h2>
          </div>
          <div className="space-y-3">
            {goalProjections.length === 0 ? (
              <p className="text-gray-500 text-sm">Add goals to see projections</p>
            ) : (
              goalProjections.map(g => (
                <AIBubble
                  key={g.id}
                  title={g.name}
                  body={
                    g.monthsLeft
                      ? `At R${Number(g.monthly_contribution).toLocaleString()}/mo, you'll reach your goal in ~${g.monthsLeft} months (${new Date(Date.now() + g.monthsLeft * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })})`
                      : `Set a monthly contribution to estimate completion time.`
                  }
                  type={g.monthsLeft && g.monthsLeft <= 12 ? 'ok' : 'info'}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingGoal ? 'Edit Goal' : 'Add Goal'}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Emergency Fund"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount (R)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({...formData, target_amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="100000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saved So Far (R)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.saved_amount}
                  onChange={(e) => setFormData({...formData, saved_amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Contribution (R)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthly_contribution}
                  onChange={(e) => setFormData({...formData, monthly_contribution: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="5000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Date (optional)</label>
                <input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({...formData, target_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                  {editingGoal ? 'Update' : 'Add Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {showDepositModal && depositGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Log Deposit</h2>
            <p className="text-sm text-gray-500 mb-4">
              Add to "{depositGoal.name}" — Currently saved: {formatCurrency(depositGoal.saved_amount)}
            </p>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (R)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="1000"
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
                >
                  Log Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}