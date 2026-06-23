import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Skeleton, { DashboardSkeleton } from './components/ui/Skeleton';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Goals from './pages/Goals';
import NetWorth from './pages/NetWorth';
import AIAdvisor from './pages/AIAdvisor';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <DashboardSkeleton />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="skeleton w-64 h-8 rounded-xl" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="skeleton w-64 h-8 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] transition-colors duration-200">
      {user && !isAuthPage && <Sidebar />}
      <div className={user && !isAuthPage ? 'lg:ml-[240px]' : ''}>
        <main className={user && !isAuthPage ? 'pt-0 lg:pt-0 pb-16 lg:pb-0' : ''}>
          <Routes location={location}>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
            <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
            <Route path="/networth" element={<ProtectedRoute><NetWorth /></ProtectedRoute>} />
            <Route path="/advisor" element={<ProtectedRoute><AIAdvisor /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {user && !isAuthPage && <MobileNav />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}