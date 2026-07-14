/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardLayout from './layouts/DashboardLayout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Login from './pages/Login.tsx';
import Inventory from './pages/Inventory.tsx';
import POS from './pages/POS.tsx';
import EmployeeManagement from './pages/EmployeeManagement.tsx';
import CreditCustomers from './pages/CreditCustomers.tsx';
import CreditNotes from './pages/CreditNotes.tsx';
import Masters from './pages/Masters.tsx';
import api from './services/api.ts';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

// --- Auth Context ---
interface User {
  id: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'INVENTORY_CLERK';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  extendSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const queryClient = new QueryClient();

// --- Protected Route Guard (with RBAC) ---
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'ADMIN' | 'MANAGER' | 'CASHIER' | 'INVENTORY_CLERK'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-4 shadow-sm">
          <ShieldAlert size={32} />
        </div>
        <h3 className="text-xl font-display font-bold text-slate-800">Access Denied</h3>
        <p className="text-slate-500 text-sm max-w-sm mt-2">
          You do not have the required permissions to view this page. Please contact your administrator.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

// Dashboard imported from ./pages/Dashboard.tsx

// POSBilling placeholder removed, imported from ./pages/POS.tsx

// InventoryEngine placeholder removed, imported from ./pages/Inventory.tsx

// MasterData placeholder removed, imported from ./pages/MasterData.tsx

// CustomerCredit placeholder removed, imported from ./pages/CustomerCredit.tsx

// Reports placeholder removed, imported from ./pages/Reports.tsx

const Settings: React.FC = () => (
  <div className="glass-card p-6">
    <h2 className="text-xl font-display font-bold text-slate-800 mb-2">System Settings</h2>
    <p className="text-slate-500 text-sm">Configure store profile, branches, user permissions, and tax codes.</p>
  </div>
);

// --- Auth Provider Component ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(60);

  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Silent Boot Check
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.data.user);
        } catch (err) {
          localStorage.removeItem('accessToken');
        }
      } else {
        // Try to refresh token silently using refresh cookie
        try {
          const res = await api.post('/auth/refresh');
          const { accessToken } = res.data.data;
          localStorage.setItem('accessToken', accessToken);
          const userRes = await api.get('/auth/me');
          setUser(userRes.data.data.user);
        } catch (err) {
          // No valid session
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleSessionExpired = () => {
      setUser(null);
      localStorage.removeItem('accessToken');
      setShowTimeoutWarning(false);
    };

    window.addEventListener('auth_session_expired', handleSessionExpired);
    return () => window.removeEventListener('auth_session_expired', handleSessionExpired);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore network error on logout
    }
    localStorage.removeItem('accessToken');
    setUser(null);
    setShowTimeoutWarning(false);
  }, []);

  // Session Inactivity Timers
  const resetTimers = useCallback(() => {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (!user) return;

    // Access token is 15m. Let's warn after 13 minutes of inactivity
    warnTimerRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
      setTimeoutCountdown(60);

      // Start Countdown
      countdownIntervalRef.current = setInterval(() => {
        setTimeoutCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 13 * 60 * 1000);

    // Hard logout after 14 minutes of inactivity
    logoutTimerRef.current = setTimeout(() => {
      logout();
    }, 14 * 60 * 1000);
  }, [user, logout]);

  // Activity listeners to reset timers
  useEffect(() => {
    if (!user) {
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    const handleActivity = () => {
      if (!showTimeoutWarning) {
        resetTimers();
      }
    };

    events.forEach((ev) => window.addEventListener(ev, handleActivity));
    resetTimers();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, showTimeoutWarning, resetTimers]);

  const login = (token: string, userData: User) => {
    localStorage.setItem('accessToken', token);
    setUser(userData);
    setShowTimeoutWarning(false);
  };

  const extendSession = async () => {
    try {
      const res = await api.post('/auth/refresh');
      const { accessToken } = res.data.data;
      localStorage.setItem('accessToken', accessToken);
      setShowTimeoutWarning(false);
      resetTimers();
    } catch (err) {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, extendSession }}>
      {children}
      
      {/* Session Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 text-center animate-fade-in">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-display font-bold text-slate-800">Session Expiring</h3>
            <p className="text-slate-500 text-sm mt-2">
              Your session will expire in <span className="font-semibold text-amber-600">{timeoutCountdown}</span> seconds due to inactivity. Do you want to extend it?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={logout}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all duration-200"
              >
                Logout
              </button>
              <button
                onClick={extendSession}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-brand-blue-600 to-brand-blue-500 hover:from-brand-blue-700 hover:to-brand-blue-600 text-white font-medium rounded-xl shadow-md shadow-brand-blue-500/10 transition-all duration-200"
              >
                Extend Session
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

// --- App Component ---
export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Protected Management Routes */}
            <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="pos" element={<POS />} />
              <Route path="inventory" element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}><Inventory /></ProtectedRoute>} />
              <Route path="employees" element={<ProtectedRoute allowedRoles={['ADMIN']}><EmployeeManagement /></ProtectedRoute>} />
              <Route path="credit-customers" element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}><CreditCustomers /></ProtectedRoute>} />
              <Route path="credit-notes" element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'CASHIER']}><CreditNotes /></ProtectedRoute>} />
              <Route path="masters" element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}><Masters /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
