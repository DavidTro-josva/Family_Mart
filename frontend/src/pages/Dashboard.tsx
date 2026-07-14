import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  AlertTriangle, 
  Coins, 
  Loader2,
  CalendarRange,
  ArrowRight,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api.ts';

// --- Type Definitions ---
interface DashboardMetrics {
  todaySales: number;
  todayCollection: number;
  todayCredit: number;
  todayTransactions: number;
  todayAOV: number;
  monthlySales: number;
  lowStockCount: number;
  isRegisterOpen: boolean;
}

interface TrendDay {
  date: string;
  sales: number;
}

interface PaymentSplit {
  CASH: number;
  UPI: number;
  CARD: number;
  SPLIT: number;
}

interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  paymentMethod: string;
  createdAt: string;
  cashier: { username: string };
  customer?: { name: string } | null;
}

interface DashboardData {
  metrics: DashboardMetrics;
  weeklyTrend: TrendDay[];
  paymentSplit: PaymentSplit;
  topProducts: TopProduct[];
  recentInvoices: RecentInvoice[];
}

export const Dashboard: React.FC = () => {
  // --- Query ---
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary');
      return res.data.data as DashboardData;
    },
    refetchInterval: 10000 // Refetch every 10s for real-time monitoring
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-blue-600" size={36} />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-12 text-slate-500">
        Failed to load dashboard data.
      </div>
    );
  }

  const { metrics, weeklyTrend, paymentSplit, topProducts, recentInvoices } = dashboard;

  // --- SVG Area Chart Calculations (Weekly Trend) ---
  const chartWidth = 500;
  const chartHeight = 150;
  const padding = 20;
  const graphWidth = chartWidth - padding * 2;
  const graphHeight = chartHeight - padding * 2;

  const maxSales = Math.max(...weeklyTrend.map((d) => d.sales), 100);

  // Generate points for the line/area
  const points = weeklyTrend.map((d, i) => {
    const x = padding + (i / (weeklyTrend.length - 1)) * graphWidth;
    const y = padding + graphHeight - (d.sales / maxSales) * graphHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${padding + graphHeight} L ${points[0].x} ${padding + graphHeight} Z`
    : '';

  // --- SVG Donut Chart Calculations (Payment Splits) ---
  const totalPaymentValue = Object.values(paymentSplit).reduce((acc, val) => acc + val, 0) || 1;
  const donutRadius = 50;
  const donutCircumference = 2 * Math.PI * donutRadius;
  
  let accumulatedPercent = 0;
  const colors = {
    CASH: '#10b981', // emerald-500
    UPI: '#0ea5e9',  // sky-500
    CARD: '#6366f1', // indigo-500
    SPLIT: '#f59e0b' // amber-500
  };

  const donutSegments = Object.entries(paymentSplit).map(([key, val]) => {
    const value = val as number;
    const percent = value / totalPaymentValue;
    const strokeDasharray = `${percent * donutCircumference} ${donutCircumference}`;
    const strokeDashoffset = -accumulatedPercent * donutCircumference;
    accumulatedPercent += percent;

    return {
      key,
      value,
      percent,
      strokeDasharray,
      strokeDashoffset,
      color: colors[key as keyof typeof colors] || '#94a3b8'
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-6">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-800">Real-time Store Monitor</h2>
          <p className="text-slate-500 text-sm mt-0.5">Live store statistics, transaction volume, and drawer monitoring.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 shrink-0">
          <CalendarRange size={14} />
          <span>Auto-refreshes every 10 seconds</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Today's Revenue */}
        <div className="glass-card p-6 border-l-4 border-l-brand-blue-500 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">Today's Revenue</span>
            <span className="p-1 rounded-lg bg-brand-blue-50 text-brand-blue-600"><TrendingUp size={14} /></span>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mt-2">₹{metrics.todaySales.toFixed(2)}</h3>
          
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Collection</div>
              <div className="text-sm font-bold text-emerald-600">₹{(metrics.todayCollection || 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Credit</div>
              <div className="text-sm font-bold text-amber-500">₹{(metrics.todayCredit || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Month to Date */}
        <div className="glass-card p-6 border-l-4 border-l-brand-green-500">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">Month to Date</span>
            <span className="p-1 rounded-lg bg-brand-green-50 text-brand-green-600"><CalendarRange size={14} /></span>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mt-2">₹{metrics.monthlySales.toFixed(2)}</h3>
          <p className="text-xs text-slate-500 mt-2">Cumulative monthly store revenue</p>
        </div>

        {/* Low Stock Alerts */}
        <div className={`glass-card p-6 border-l-4 
          ${metrics.lowStockCount > 0 ? 'border-l-amber-500 bg-amber-50/5' : 'border-l-slate-300'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">Low Stock Alerts</span>
            <span className={`p-1 rounded-lg ${metrics.lowStockCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
              <AlertTriangle size={14} />
            </span>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mt-2">{metrics.lowStockCount} Items</h3>
          <p className="text-xs text-slate-500 mt-2">
            {metrics.lowStockCount > 0 ? (
              <Link to="/inventory" className="text-amber-600 font-semibold hover:underline flex items-center gap-0.5">
                <span>Restock now</span>
                <ArrowRight size={10} />
              </Link>
            ) : 'All products well stocked'}
          </p>
        </div>

        {/* Cash Register Status */}
        <div className={`glass-card p-6 border-l-4 
          ${metrics.isRegisterOpen ? 'border-l-emerald-500' : 'border-l-red-500 bg-red-50/5'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">Register Status</span>
            <span className={`p-1 rounded-lg ${metrics.isRegisterOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <Coins size={14} />
            </span>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mt-2">
            {metrics.isRegisterOpen ? 'Open & Active' : 'Closed'}
          </h3>
          <p className="text-xs text-slate-500 mt-2">
            {metrics.isRegisterOpen ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <ShieldCheck size={12} /> Cashier shift in progress
              </span>
            ) : (
              <Link to="/register" className="text-red-600 font-semibold hover:underline flex items-center gap-0.5">
                <ShieldAlert size={12} /> <span>Open register to sell</span>
              </Link>
            )}
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Trend Area Chart */}
        <div className="lg:col-span-8 glass-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-slate-800 text-base">Weekly Sales Trend</h3>
            <p className="text-xs text-slate-500 mt-0.5">Sales performance over the last 7 days.</p>
          </div>

          {/* SVG Graph */}
          <div className="relative w-full h-44 mt-4">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.00" />
                </linearGradient>
              </defs>
              
              {/* Gridlines */}
              <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#f1f5f9" strokeWidth="1" />
              <line x1={padding} y1={padding + graphHeight / 2} x2={chartWidth - padding} y2={padding + graphHeight / 2} stroke="#f1f5f9" strokeWidth="1" />
              <line x1={padding} y1={padding + graphHeight} x2={chartWidth - padding} y2={padding + graphHeight} stroke="#e2e8f0" strokeWidth="1" />

              {/* Area */}
              {areaPath && <path d={areaPath} fill="url(#chartGrad)" />}

              {/* Line */}
              {linePath && <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

              {/* Dots & Labels */}
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="3" fill="#ffffff" stroke="#3b82f6" strokeWidth="2" />
                  <text 
                    x={p.x} 
                    y={chartHeight - 2} 
                    textAnchor="middle" 
                    className="text-[9px] fill-slate-400 font-medium"
                  >
                    {weeklyTrend[i].date}
                  </text>
                  <text 
                    x={p.x} 
                    y={p.y - 8} 
                    textAnchor="middle" 
                    className="text-[9px] fill-slate-700 font-bold"
                  >
                    ${weeklyTrend[i].sales.toFixed(0)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Payment Methods Donut Chart */}
        <div className="lg:col-span-4 glass-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-slate-800 text-base">Payment Distribution</h3>
            <p className="text-xs text-slate-500 mt-0.5">Payment splits over the last 30 days.</p>
          </div>

          <div className="flex items-center justify-between gap-4 mt-4">
            {/* SVG Donut */}
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.key}
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="14"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    className="transition-all duration-500"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Total</span>
                <span className="text-xs font-bold text-slate-700">₹{totalPaymentValue.toFixed(0)}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2.5 text-xs">
              {donutSegments.map((seg) => (
                <div key={seg.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    <span className="font-medium">{seg.key}</span>
                  </div>
                  <span className="font-bold text-slate-800">
                    {(seg.percent * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Products & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Selling Products */}
        <div className="lg:col-span-5 glass-card p-6">
          <h3 className="font-display font-bold text-slate-800 text-base mb-4">Top Selling Products</h3>
          {topProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No sales recorded in the last 30 days.</div>
          ) : (
            <div className="space-y-3.5">
              {topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="min-w-0 pr-4">
                    <div className="font-semibold text-slate-800 truncate text-xs">{p.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{p.qty} units sold</div>
                  </div>
                  <div className="text-right text-xs font-bold text-slate-700 shrink-0">
                    ₹{p.revenue.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="lg:col-span-7 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-slate-800 text-base">Recent Sales Transactions</h3>
            <Link to="/pos" className="text-xs text-brand-blue-600 font-semibold hover:underline">New Sale</Link>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No transactions recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 font-medium border-b border-slate-100 pb-2">
                    <th className="pb-2">Invoice #</th>
                    <th className="pb-2">Customer</th>
                    <th className="pb-2">Payment</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5">
                        <span className="font-semibold text-slate-800">{inv.invoiceNumber}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{new Date(inv.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {inv.customer?.name || 'Walk-in'}
                      </td>
                      <td className="py-2.5">
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase">
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-bold text-slate-800">
                        ₹{inv.grandTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
