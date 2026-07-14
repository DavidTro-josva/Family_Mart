import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Database, 
  Users, 
  RotateCcw, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  ChevronLeft,
  ChevronRight,
  Wallet,
  ShieldAlert,
  Truck,
  Archive,
  TrendingUp,
  ArrowLeftRight,
  FileText,
  Landmark,
  LineChart,
  Sparkles,
  Search
} from 'lucide-react';
import { useAuth } from '../App.tsx';

export const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const navigation = [
    { name: 'Daily Sales Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Bill Generate', href: '/pos', icon: ShoppingCart },
    { name: 'Stock & Products', href: '/inventory', icon: Package },
    { name: 'Employee Management', href: '/employees', icon: Users },
    { name: 'Credit Customers', href: '/credit-customers', icon: Wallet },
    { name: 'Credit Notes', href: '/credit-notes', icon: RotateCcw },
    { name: 'Master Data', href: '/masters', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 print:hidden
          ${isSidebarOpen ? 'w-64' : 'w-20'} 
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-green-500 to-brand-blue-600 text-white font-bold text-xs shrink-0 shadow-md">
              TDS
            </div>
            {isSidebarOpen && (
              <span className="font-display font-bold text-lg bg-gradient-to-r from-brand-green-600 to-brand-blue-700 bg-clip-text text-transparent truncate">
                Thangam Store
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-100 lg:hidden text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                  ${isActive 
                    ? 'bg-gradient-to-r from-brand-blue-50/80 to-brand-green-50/50 text-brand-blue-700 shadow-sm border border-brand-blue-100/30' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                <Icon 
                  size={20} 
                  className={`transition-colors shrink-0
                    ${isActive ? 'text-brand-blue-600' : 'text-slate-400 group-hover:text-slate-600'}
                  `} 
                />
                {isSidebarOpen && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600 font-semibold shrink-0">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{user?.username || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email || ''}</p>
              </div>
            )}
            {isSidebarOpen && (
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
          {!isSidebarOpen && (
            <button 
              onClick={handleLogout}
              className="mt-4 w-full p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex justify-center"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 print:hidden">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-100 lg:hidden text-slate-600"
            >
              <Menu size={20} />
            </button>

            {/* Collapse sidebar button (Desktop) */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>

            <h1 className="font-display font-semibold text-lg text-slate-800 hidden md:block">
              {navigation.find(n => n.href === location.pathname)?.name || 'Management Panel'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Center */}
            <button className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>

            {/* Quick POS Access Button */}
            <Link 
              to="/pos" 
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-green-600 hover:bg-brand-green-700 text-white text-sm font-medium shadow-sm shadow-brand-green-600/10 transition-all duration-200"
            >
              <ShoppingCart size={16} />
              <span>New Sale (F10)</span>
            </Link>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50 print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-7xl mx-auto animate-fade-in print:max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
