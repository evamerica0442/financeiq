# FinanceIQ - Smart Finance Management

A full-stack personal finance web application with AI-powered insights, built with React, Express, PostgreSQL (Neon), and Groq AI.

## Tech Stack

- **Frontend:** React (Vite), React Router, Chart.js, Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL hosted on [Neon](https://neon.tech) (free tier)
- **Auth:** JWT stored in httpOnly cookies, bcrypt for password hashing
- **AI:** Groq API (llama-3.1-8b-instant) for financial insights and chat (free tier available at console.groq.com)

## Features

- 📊 **Dashboard** - Monthly metrics, spending charts, budget overview, AI insights
- 💳 **Transactions** - Full CRUD with category/month filtering
- 💰 **Budgets** - Category budgets with visual progress bars
- 🎯 **Goals** - Savings goals with projections and deposit logging
- 🏦 **Net Worth** - Assets/liabilities tracking with trend chart
- 🤖 **AI Advisor** - Chat with Groq AI about your finances, get personalised advice

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended - free at neon.tech)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd financeiq
npm install
cd client && npm install && cd ..
```

### 2. Database Setup

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project — copy the connection string
3. Open the Neon SQL Editor and paste/run the contents of `server/db/schema.sql` to create all tables
4. Copy the connection string

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=your_jwt_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
NODE_ENV=development
```

### 4. Seed Demo Data (Optional)

```bash
npm run seed
```

This creates a demo user with sample data:
- **Email:** demo@financeiq.app
- **Password:** demo1234

### 5. Run Development Server

```bash
npm run dev
```

This starts both the Express backend (port 3001) and Vite dev server (port 5173).

## Deployment (Render.com)

### Option 1: Single Service (Simplest)

1. Push your code to GitHub
2. Go to [Render.com](https://render.com) and create a new **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Add environment variables:
   - `DATABASE_URL` - Your Neon connection string
   - `JWT_SECRET` - Your JWT secret
   - `GEMINI_API_KEY` - Your Google Gemini API key (get one free at aistudio.google.com)
   - `NODE_ENV` = `production`

### Option 2: Using render.yaml

1. Push your code to GitHub
2. Go to Render dashboard → Blueprint
3. Connect your repository
4. Set the encrypted environment variables in the Render dashboard:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `GEMINI_API_KEY`

## API Routes

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Transactions (Protected)
- `GET /api/transactions` - List transactions (?month=2026-06)
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Budgets (Protected)
- `GET /api/budgets` - List budgets
- `POST /api/budgets` - Upsert budget
- `DELETE /api/budgets/:id` - Delete budget

### Goals (Protected)
- `GET /api/goals` - List goals
- `POST /api/goals` - Create goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal

### Net Worth (Protected)
- `GET /api/networth` - List assets/liabilities
- `POST /api/networth` - Add asset/liability
- `PUT /api/networth/:id` - Update
- `DELETE /api/networth/:id` - Delete

### AI (Protected)
- `POST /api/ai/insights` - Get financial insights
- `POST /api/ai/chat` - Chat with AI advisor

## Category Options

Transactions support: Housing, Groceries, Transport, Dining out, Utilities, Subscriptions, Health, Entertainment, Education, Savings, Income, Other