import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import { CategoriesProvider } from './hooks/useCategories';
import ErrorBoundary from './components/ErrorBoundary';
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
import Journal from './pages/Journal';
import Categories from './pages/Categories';
import Reports from './pages/Reports';

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
            <Route path="/" element={<ProtectedRoute><ErrorBoundary><Dashboard /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><ErrorBoundary><Transactions /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/budgets" element={<ProtectedRoute><ErrorBoundary><Budgets /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/goals" element={<ProtectedRoute><ErrorBoundary><Goals /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/networth" element={<ProtectedRoute><ErrorBoundary><NetWorth /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute><ErrorBoundary><Categories /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ErrorBoundary><Reports /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/advisor" element={<ProtectedRoute><ErrorBoundary><AIAdvisor /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/journal" element={<ProtectedRoute><ErrorBoundary><Journal /></ErrorBoundary></ProtectedRoute>} />
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
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <CategoriesProvider>
              <AppContent />
            </CategoriesProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
