require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const goalRoutes = require('./routes/goals');
const networthRoutes = require('./routes/networth');
const aiRoutes = require('./routes/ai');
const importRoutes = require('./routes/import');
const exportRoutes = require('./routes/export');
const categoryRoutes = require('./routes/categories');
const reportRoutes = require('./routes/reports');
const analysisRoutes = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false
    : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/networth', networthRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analysis', analysisRoutes);

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const possiblePaths = [
    path.join(__dirname, '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
  ];

  let clientDistPath = null;
  for (const p of possiblePaths) {
    try {
      require('fs').accessSync(p);
      clientDistPath = p;
      break;
    } catch {
      // try next
    }
  }

  if (clientDistPath) {
    console.log('Serving React client from:', clientDistPath);
    app.use(express.static(clientDistPath, { index: 'index.html' }));
  } else {
    console.warn('React build not found in any expected location:', possiblePaths);
    console.warn('Running in API-only mode. Ensure the client build step runs successfully.');
  }

  // Always provide the catch-all route so SPAs work
  app.get('*', (req, res) => {
    if (clientDistPath) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    } else {
      res.status(503).json({ error: 'Frontend not built. Please check deployment build logs.' });
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FinanceIQ server running on port ${PORT}`);
});