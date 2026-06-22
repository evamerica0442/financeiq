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

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  // Try multiple possible paths for the client build
  const possiblePaths = [
    path.resolve(process.cwd(), 'client/dist'),
    path.join(__dirname, '../client/dist'),
    path.join(__dirname, '../../client/dist'),
  ];

  let clientDistPath = null;
  for (const p of possiblePaths) {
    try {
      require('fs').accessSync(p);
      clientDistPath = p;
      break;
    } catch {
      // Try next path
    }
  }

  if (clientDistPath) {
    console.log('Serving React client from:', clientDistPath);
    app.use(express.static(clientDistPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    console.warn('React build not found in any expected location. Searched:', possiblePaths);
    console.warn('Running in API-only mode. Ensure the client build step runs successfully.');
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FinanceIQ server running on port ${PORT}`);
});