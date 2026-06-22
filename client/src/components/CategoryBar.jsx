import React from 'react';

export default function CategoryBar({ category, spent, limit, color = 'blue' }) {
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const absSpent = Math.abs(spent);

  let barColor = 'bg-green-500';
  let textColor = 'text-green-700';
  if (percentage >= 100) {
    barColor = 'bg-red-500';
    textColor = 'text-red-700';
  } else if (percentage >= 80) {
    barColor = 'bg-yellow-500';
    textColor = 'text-yellow-700';
  }

  const formatCurrency = (amount) => {
    return 'R' + Math.abs(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{category}</span>
        <span className={`text-sm font-medium ${textColor}`}>
          {formatCurrency(absSpent)} {limit > 0 && `/ ${formatCurrency(limit)}`}
        </span>
      </div>
      {limit > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      )}
    </div>
  );
}