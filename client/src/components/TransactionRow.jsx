import React from 'react';

export default function TransactionRow({ transaction, onEdit, onDelete }) {
  const isIncome = transaction.amount > 0;
  const absAmount = Math.abs(transaction.amount);

  const formatCurrency = (amount) => {
    return 'R' + amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const categoryColors = {
    'Housing': 'bg-gray-100 text-gray-700',
    'Groceries': 'bg-green-100 text-green-700',
    'Transport': 'bg-yellow-100 text-yellow-700',
    'Dining out': 'bg-orange-100 text-orange-700',
    'Utilities': 'bg-blue-100 text-blue-700',
    'Subscriptions': 'bg-purple-100 text-purple-700',
    'Health': 'bg-red-100 text-red-700',
    'Entertainment': 'bg-pink-100 text-pink-700',
    'Education': 'bg-indigo-100 text-indigo-700',
    'Savings': 'bg-teal-100 text-teal-700',
    'Income': 'bg-emerald-100 text-emerald-700',
    'Other': 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="flex items-center space-x-3 flex-1">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{transaction.name}</p>
          <p className="text-xs text-gray-500">{formatDate(transaction.date)}</p>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryColors[transaction.category] || 'bg-gray-100 text-gray-700'}`}>
          {transaction.category}
        </span>
      </div>
      <div className="flex items-center space-x-3 ml-4">
        <span className={`text-sm font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
          {isIncome ? '+' : '-'}{formatCurrency(absAmount)}
        </span>
        <div className="flex space-x-1">
          <button
            onClick={() => onEdit(transaction)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(transaction.id)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}