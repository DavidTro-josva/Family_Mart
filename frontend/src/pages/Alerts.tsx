import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api.js';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Info, 
  Check, 
  ShoppingCart, 
  Users, 
  Lock,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: 'STOCK' | 'FINANCIAL' | 'SECURITY' | 'DISCOUNT' | string;
  createdAt: string;
}

export const Alerts: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Fetch active unread alerts
  const { data: alerts, isLoading } = useQuery<AlertItem[]>({
    queryKey: ['system-alerts'],
    queryFn: async () => {
      const res = await api.get('/alerts');
      return res.data.data;
    },
    refetchInterval: 15000, // Poll every 15s for live alerts!
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await api.post(`/alerts/${alertId}/dismiss`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
    },
  });

  const getSeverityStyle = (severity: 'INFO' | 'WARNING' | 'CRITICAL') => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-50 border-rose-100 text-rose-800 ring-rose-500/20';
      case 'WARNING':
        return 'bg-amber-50 border-amber-100 text-amber-800 ring-amber-500/20';
      case 'INFO':
      default:
        return 'bg-blue-50 border-blue-100 text-blue-800 ring-blue-500/20';
    }
  };

  const getSeverityIcon = (severity: 'INFO' | 'WARNING' | 'CRITICAL') => {
    switch (severity) {
      case 'CRITICAL':
        return <ShieldAlert className="h-5 w-5 text-rose-600 animate-pulse" />;
      case 'WARNING':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'INFO':
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getActionLink = (alert: AlertItem) => {
    const msg = alert.message.toLowerCase();
    if (alert.category === 'STOCK') {
      return { label: 'Restock Product', href: '/procurement', icon: ShoppingCart };
    }
    if (alert.category === 'FINANCIAL' && msg.includes('credit')) {
      return { label: 'Review Customer Credit', href: '/credit', icon: Users };
    }
    if (alert.category === 'FINANCIAL' && msg.includes('register')) {
      return { label: 'Audit Shift Session', href: '/register', icon: Users };
    }
    if (alert.category === 'SECURITY') {
      return { label: 'System Audit Logs', href: '/audit', icon: Lock };
    }
    if (alert.category === 'DISCOUNT') {
      return { label: 'Inspect Invoices', href: '/dashboard', icon: TrendingDown };
    }
    return null;
  };

  const filteredAlerts = alerts?.filter(a => {
    if (filterCategory === 'ALL') return true;
    return a.category === filterCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-brand-blue-600" />
            Smart Alerts & Business Rules
          </h1>
          <p className="text-slate-500 text-sm mt-1">Real-time alerts for low stock, expiring inventory, credit breaches, and cash variances</p>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'STOCK', 'FINANCIAL', 'SECURITY', 'DISCOUNT'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              filterCategory === cat
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Scanning system for active alerts...</div>
      ) : filteredAlerts && filteredAlerts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">System Healthy</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">All business rules are fully satisfied. No active alerts or discrepancies detected.</p>
        </div>
      ) : filteredAlerts && (
        <div className="grid grid-cols-1 gap-4">
          {filteredAlerts.map(alert => {
            const action = getActionLink(alert);
            return (
              <div 
                key={alert.id} 
                className={`p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all shadow-sm ring-1 ${getSeverityStyle(alert.severity)}`}
              >
                <div className="flex gap-3.5 items-start">
                  <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{alert.title}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-200/55 rounded-md text-slate-500">
                        {alert.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{alert.message}</p>
                    <span className="block text-[10px] text-slate-400 font-semibold">
                      Triggered {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  {action && (
                    <button
                      onClick={() => window.location.href = action.href}
                      className="flex items-center gap-1 px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <action.icon className="h-3.5 w-3.5" />
                      {action.label}
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                    </button>
                  )}
                  <button
                    onClick={() => dismissMutation.mutate(alert.id)}
                    className="flex items-center gap-1 px-3.5 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default Alerts;
