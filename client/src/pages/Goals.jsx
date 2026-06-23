import React, { useState, useEffect } from 'react';
import api from '../api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import BottomSheet from '../components/ui/BottomSheet';
import AmountInput from '../components/ui/AmountInput';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../hooks/useToast';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [showDepositSheet, setShowDepositSheet] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [formData, setFormData] = useState({
    name: '', target_amount: '', saved_amount: '0', monthly_contribution: '0', target_date: ''
  });
  const [formError, setFormError] = useState('');
  const { addToast } = useToast();

  useEffect(() => { fetchGoals(); }, []);

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

  function openAddSheet() {
    setSelectedGoal(null);
    setFormData({ name: '', target_amount: '', saved_amount: '0', monthly_contribution: '0', target_date: '' });
    setFormError('');
    setShowSheet(true);
  }

  function openDetailSheet(goal) {
    setSelectedGoal(goal);
    setShowSheet(true);
  }

  function openDepositSheet(goal) {
    setSelectedGoal(goal);
    setDepositAmount('');
    setShowDepositSheet(true);
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
    if (isNaN(target) || target <= 0) { setFormError('Target must be a positive number.'); return; }

    try {
      if (selectedGoal) {
        await api.put(`/goals/${selectedGoal.id}`, { name: formData.name, target_amount: target, saved_amount: saved, monthly_contribution: contribution, target_date: formData.target_date || null });
        addToast('Goal updated', 'success');
      } else {
        await api.post('/goals', { name: formData.name, target_amount: target, saved_amount: saved, monthly_contribution: contribution, target_date: formData.target_date || null });
        addToast('Goal created', 'success');
      }
      setShowSheet(false);
      fetchGoals();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save goal.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/goals/${id}`);
      addToast('Goal deleted', 'info');
      fetchGoals();
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  }

  async function handleDeposit(e) {
    e.preventDefault();
    if (!selectedGoal || !depositAmount) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) { setFormError('Enter a valid amount.'); return; }

    const newSaved = Number(selectedGoal.saved_amount) + amount;
    try {
      await api.put(`/goals/${selectedGoal.id}`, {
        name: selectedGoal.name, target_amount: selectedGoal.target_amount, saved_amount: newSaved,
        monthly_contribution: selectedGoal.monthly_contribution, target_date: selectedGoal.target_date
      });
      addToast(`R${amount.toLocaleString()} deposited!`, 'success');
      setShowDepositSheet(false);
      fetchGoals();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to log deposit.');
    }
  }

  const totalSaved = goals.reduce((sum, g) => sum + Number(g.saved_amount), 0);
  const formatCurrency = (amount) => 'R' + Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <Skeleton variant="title" className="mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} variant="card" height="200px" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
      {/* Hero */}
      <div className="animate-on-mount">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Goals</h1>
        <p className="text-sm text-[var(--text-secondary)]">{goals.length} goals tracked</p>
      </div>

      {goals.length > 0 && (
        <Card glow="green">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Total saved</p>
              <p className="text-3xl font-bold text-[var(--text-primary)] tracking-tight tabular-nums">{formatCurrency(totalSaved)}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-green)]/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--accent-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Card>
      )}

      {/* Goal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.length > 0 ? goals.map(goal => {
          const progress = goal.target_amount > 0 ? (goal.saved_amount / goal.target_amount) * 100 : 0;
          const remaining = Number(goal.target_amount) - Number(goal.saved_amount);
          const monthsLeft = goal.monthly_contribution > 0 ? Math.ceil(remaining / Number(goal.monthly_contribution)) : null;

          return (
            <Card key={goal.id} hover onClick={() => openDetailSheet(goal)}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--accent-blue)]/10 flex items-center justify-center text-xl flex-shrink-0">
                  🎯
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--text-primary)]">{goal.name}</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formatCurrency(goal.saved_amount)} of {formatCurrency(goal.target_amount)}
                  </p>
                </div>
                <Badge variant={progress >= 100 ? 'ok' : 'default'} size="sm">
                  {progress.toFixed(0)}%
                </Badge>
              </div>

              <ProgressBar value={Number(goal.saved_amount)} max={Number(goal.target_amount)} height="h-3" />

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-[var(--text-secondary)]">
                  {monthsLeft !== null ? `~${monthsLeft} months left` : 'No monthly contribution set'}
                </span>
                {goal.monthly_contribution > 0 && (
                  <span className="text-xs font-medium text-[var(--accent-green)]">
                    {formatCurrency(goal.monthly_contribution)}/mo
                  </span>
                )}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); openDepositSheet(goal); }}
                className="mt-3 w-full py-2 rounded-xl bg-[var(--accent-green)]/10 text-[var(--accent-green)] text-sm font-medium hover:bg-[var(--accent-green)]/20 transition-colors"
              >
                + Log deposit
              </button>
            </Card>
          );
        }) : (
          <div className="md:col-span-2 flex flex-col items-center py-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 text-3xl">
              🎯
            </div>
            <p className="text-lg font-medium text-[var(--text-primary)] mb-1">No goals yet</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Set your first financial goal and start tracking progress</p>
            <Button onClick={openAddSheet}>Create Goal</Button>
          </div>
        )}
      </div>

      {/* FAB */}
      {goals.length > 0 && (
        <button
          onClick={openAddSheet}
          className="fixed bottom-20 lg:bottom-8 right-6 z-40 w-14 h-14 rounded-2xl bg-[var(--accent-green)] text-[#0D0F14] shadow-[var(--shadow-glow-green)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Add goal"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Goal Detail / Add Sheet */}
      <BottomSheet isOpen={showSheet} onClose={() => setShowSheet(false)} title={selectedGoal && !showDepositSheet ? 'Goal Details' : 'New Goal'}>
        {selectedGoal && !showDepositSheet ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent-blue)]/10 flex items-center justify-center text-2xl mx-auto mb-3">
                🎯
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{selectedGoal.name}</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {formatCurrency(selectedGoal.saved_amount)} of {formatCurrency(selectedGoal.target_amount)}
              </p>
            </div>

            <ProgressBar value={Number(selectedGoal.saved_amount)} max={Number(selectedGoal.target_amount)} height="h-4" showLabel />

            {(() => {
              const remaining = Number(selectedGoal.target_amount) - Number(selectedGoal.saved_amount);
              const monthsLeft = selectedGoal.monthly_contribution > 0 ? Math.ceil(remaining / Number(selectedGoal.monthly_contribution)) : null;
              return (
                <Card>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Remaining</span>
                      <span className="font-medium text-[var(--text-primary)]">{formatCurrency(remaining)}</span>
                    </div>
                    {monthsLeft && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">At this pace</span>
                        <span className="font-medium text-[var(--accent-purple)]">~{monthsLeft} months</span>
                      </div>
                    )}
                    {selectedGoal.monthly_contribution > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">Monthly contribution</span>
                        <span className="font-medium text-[var(--accent-green)]">{formatCurrency(selectedGoal.monthly_contribution)}</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })()}

            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => handleDelete(selectedGoal.id)}>
                Delete
              </Button>
              <Button fullWidth onClick={() => openDepositSheet(selectedGoal)}>
                Log Deposit
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <div className="p-3 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 text-[var(--accent-red)] rounded-xl text-sm">{formError}</div>}
            <Input label="Goal name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Emergency Fund" required />
            <AmountInput label="Target amount" value={formData.target_amount} onChange={(v) => setFormData({...formData, target_amount: v})} placeholder="100000" required />
            <Input label="Saved so far (R)" type="number" value={formData.saved_amount} onChange={(e) => setFormData({...formData, saved_amount: e.target.value})} placeholder="0" />
            <Input label="Monthly contribution (R)" type="number" value={formData.monthly_contribution} onChange={(e) => setFormData({...formData, monthly_contribution: e.target.value})} placeholder="5000" />
            <Input label="Target date (optional)" type="date" value={formData.target_date} onChange={(e) => setFormData({...formData, target_date: e.target.value})} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" fullWidth onClick={() => setShowSheet(false)}>Cancel</Button>
              <Button type="submit" fullWidth>{selectedGoal ? 'Update' : 'Create Goal'}</Button>
            </div>
          </form>
        )}
      </BottomSheet>

      {/* Deposit Sheet */}
      <BottomSheet isOpen={showDepositSheet} onClose={() => setShowDepositSheet(false)} title="Log Deposit">
        {selectedGoal && (
          <form onSubmit={handleDeposit} className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Adding to <strong className="text-[var(--text-primary)]">{selectedGoal.name}</strong> — Currently saved: {formatCurrency(selectedGoal.saved_amount)}
            </p>
            <AmountInput label="Deposit amount" value={depositAmount} onChange={setDepositAmount} placeholder="1000" required />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" fullWidth onClick={() => setShowDepositSheet(false)}>Cancel</Button>
              <Button type="submit" fullWidth>Log Deposit</Button>
            </div>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}