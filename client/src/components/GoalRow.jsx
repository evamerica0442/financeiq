import React from 'react';

export default function GoalRow({ goal, onEdit, onDelete, onDeposit }) {
  const progress = goal.target_amount > 0 ? (goal.saved_amount / goal.target_amount) * 100 : 0;
  const remaining = goal.target_amount - goal.saved_amount;
  const monthsToComplete = goal.monthly_contribution > 0 ? Math.ceil(remaining / goal.monthly_contribution) : null;

  const formatCurrency = (amount) => {
    return 'R' + Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  let progressColor = 'bg-green-500';
  if (progress >= 100) {
    progressColor = 'bg-emerald-500';
  } else if (progress >= 50) {
    progressColor = 'bg-blue-500';
  } else {
    progressColor = 'bg-yellow-500';
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{goal.name}</h3>
          {goal.target_date && (
            <p className="text-xs text-gray-500">Target: {new Date(goal.target_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          )}
        </div>
        <div className="flex space-x-1">
          <button onClick={() => onEdit(goal)} className="p-1 text-gray-400 hover:text-blue-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(goal.id)} className="p-1 text-gray-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-600">{formatCurrency(goal.saved_amount)} saved</span>
        <span className="text-gray-600">of {formatCurrency(goal.target_amount)}</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${progressColor}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        ></div>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="font-semibold text-gray-900">{progress.toFixed(1)}% complete</span>
        {monthsToComplete !== null && (
          <span className="text-gray-500">~{monthsToComplete} months left</span>
        )}
      </div>

      <div className="mt-3 flex space-x-2">
        <button
          onClick={() => onDeposit(goal)}
          className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Log Deposit
        </button>
        {goal.monthly_contribution > 0 && (
          <span className="text-xs text-gray-500 self-center">
            R{Number(goal.monthly_contribution).toLocaleString()}/mo
          </span>
        )}
      </div>
    </div>
  );
}