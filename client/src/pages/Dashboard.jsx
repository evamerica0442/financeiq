import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import api from '../api';
import MetricCard from '../components/MetricCard';
import CategoryBar from '../components/CategoryBar';
import TransactionRow from '../components/TransactionRow';
import AIBubble from '../components/AIBubble';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [txRes, budgetRes, assetRes] = await Promise.all([
        api.get('/transactions?month=' + new Date().toISOString().slice(0, 7)),
        api.get('/budgets'),
        api.get('/networth')
      ]);
      setTransactions(txRes.data);
      setBudgets(budgetRes.data);
      setAssets(assetRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (transactions.length > 0 || budgets.length > 0 || assets.length > 0) {
      fetchInsights();
    }
  }, [transactions, budgets, assets]);

  async function fetchInsights() {
    try {
      const res = await api.post('/ai/insights', {
        transactions,
        budgets,
        assets
      });
      setInsights(res.data);
    } catch {
      // Insights are optional, fail silently
    }
  }

  // Calculate metrics
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyIncome = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const monthlySpent = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const monthlySaved = monthlyIncome - monthlySpent;

  const totalAssets = assets
    .filter(a => a.type === 'asset')
    .reduce((sum, a) => sum + Number(a.value), 0);
  const totalLiabilities = assets
    .filter(a => a.type === 'liability')
    .reduce((sum, a) => sum + Math.abs(Number(a.value)), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Spending by category for current month
  const spendingByCategory = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category;
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(Number(t.amount));
  });

  // Budget comparison
  const budgetMap = {};
  budgets.forEach(b => { budgetMap[b.category] = Number(b.monthly_limit); });

  const categoryData = Object.entries(spendingByCategory).map(([category, spent]) => ({
    category,
    spent,
    limit: budgetMap[category] || 0
  }));

  // 6-month income vs spending chart
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  const monthlyChartData = {
    labels: months.map(m => {
      const [y, month] = m.split('-');
      const date = new Date(y, month - 1);
      return date.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
    }),
    datasets: [
      {
        label: 'Income',
        data: months.map(m => {
          // We need to fetch all transactions for this, but for now use what we have
          // In production, you'd fetch all months data
          return 45000; // Placeholder - in real app fetch all data
        }),
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2,
      },
      {
        label: 'Spending',
        data: months.map(m => {
          return 28000; // Placeholder
        }),
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Income vs Spending (6 Months)' }
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => 'R' + (value / 1000).toFixed(0) + 'k'
        }
      }
    }
  };

  // Category spending bar chart data
  const barChartData = {
    labels: categoryData.map(c => c.category),
    datasets: [{
      label: 'Spent',
      data: categoryData.map(c => c.spent),
      backgroundColor: categoryData.map(c => {
        const pct = c.limit > 0 ? (c.spent / c.limit) * 100 : 0;
        if (pct >= 100) return 'rgba(239, 68, 68, 0.7)';
        if (pct >= 80) return 'rgba(234, 179, 8, 0.7)';
        return 'rgba(59, 130, 246, 0.7)';
      }),
      borderColor: categoryData.map(c => {
        const pct = c.limit > 0 ? (c.spent / c.limit) * 100 : 0;
        if (pct >= 100) return 'rgb(239, 68, 68)';
        if (pct >= 80) return 'rgb(234, 179, 8)';
        return 'rgb(59, 130, 246)';
      }),
      borderWidth: 1,
    }]
  };

  const barOptions = {
    responsive: true,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Spending by Category' }
    },
    scales: {
      x: {
        ticks: {
          callback: (value) => 'R' + (value / 1000).toFixed(0) + 'k'
        }
      }
    }
  };

  const formatCurrency = (amount) => {
    const prefix = amount < 0 ? '-' : '';
    return prefix + 'R' + Math.abs(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Monthly Income"
          value={formatCurrency(monthlyIncome)}
          icon="💰"
          color="green"
        />
        <MetricCard
          title="Total Spent"
          value={formatCurrency(monthlySpent)}
          icon="💳"
          color="red"
        />
        <MetricCard
          title="Saved This Month"
          value={formatCurrency(monthlySaved)}
          icon="🏦"
          color={monthlySaved >= 0 ? 'blue' : 'red'}
        />
        <MetricCard
          title="Net Worth"
          value={formatCurrency(netWorth)}
          icon="📈"
          color={netWorth >= 0 ? 'purple' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Spending by Category Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          {categoryData.length > 0 ? (
            <Bar data={barChartData} options={barOptions} />
          ) : (
            <p className="text-gray-500 text-center py-8">No spending data for this month</p>
          )}
        </div>

        {/* AI Insights Panel */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-semibold text-gray-900">AI Insights</h2>
          </div>
          {insights ? (
            <div className="space-y-3">
              {insights.highlights?.slice(0, 3).map((h, i) => (
                <AIBubble key={i} title={h.label} body={h.text} type={h.type} />
              ))}
              {insights.tips?.slice(0, 2).map((t, i) => (
                <AIBubble key={i} title={t.title} body={t.body} type={t.type} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">Loading insights...</p>
              <div className="mt-2 animate-pulse space-y-3">
                <div className="h-16 bg-gray-100 rounded-lg"></div>
                <div className="h-16 bg-gray-100 rounded-lg"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Budget Progress */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Overview</h2>
        <div className="space-y-4">
          {categoryData.length > 0 ? (
            categoryData.slice(0, 6).map((c) => (
              <CategoryBar key={c.category} category={c.category} spent={c.spent} limit={c.limit} />
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No budget data for this month</p>
          )}
        </div>
      </div>

      {/* Income vs Spending Chart */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
        <Line data={monthlyChartData} options={lineOptions} />
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentTransactions.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} onEdit={() => {}} onDelete={() => {}} />
          ))}
          {recentTransactions.length === 0 && (
            <p className="text-gray-500 text-center py-8">No transactions this month</p>
          )}
        </div>
      </div>
    </div>
  );
}