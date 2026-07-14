import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api.js';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  ArrowUpRight, 
  ArrowDownLeft, 
  PieChart, 
  Layers,
  Clock
} from 'lucide-react';

interface KPIData {
  today: {
    revenue: number;
    revenueTrend: number;
    transactions: number;
    transactionsTrend: number;
    grossProfit: number;
    margin: number;
  };
  mtd: {
    revenue: number;
    revenueTrend: number;
    cogs: number;
    grossProfit: number;
    margin: number;
    marginTrend: number;
  };
  workingCapital: {
    receivables: number;
    payables: number;
    inventoryCost: number;
    netWorkingCapital: number;
  };
}

interface SalesAnalyticsData {
  hourlySales: { hour: number; revenue: number; count: number }[];
  weekdaySales: { day: number; name: string; revenue: number; count: number }[];
  paymentMethods: { [key: string]: number };
  basketSizes: { size: string; count: number }[];
  basketSummary: {
    totalTransactions: number;
    totalItemsSold: number;
    averageBasketSize: number;
  };
  peakHours: number[];
}

export const ExecutiveBI: React.FC = () => {
  // Date Range (for detailed analytics)
  const [startDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [endDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch Executive KPIs
  const { data: kpis, isLoading: isKpisLoading } = useQuery<KPIData>({
    queryKey: ['executive-kpis'],
    queryFn: async () => {
      const res = await api.get('/bi/kpis');
      return res.data.data;
    },
  });

  // Fetch Sales Analytics
  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery<SalesAnalyticsData>({
    queryKey: ['sales-analytics-bi', startDate, endDate],
    queryFn: async () => {
      const res = await api.get('/bi/sales-analytics', { params: { startDate, endDate } });
      return res.data.data;
    },
  });

  const formatTrend = (trend: number) => {
    const isPositive = trend >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
        {isPositive ? '+' : ''}{trend.toFixed(1)}%
      </span>
    );
  };

  // Helper to render SVG Bar Chart for Hourly Sales
  const renderHourlyChart = (data: { hour: number; revenue: number }[]) => {
    const maxVal = Math.max(...data.map(h => h.revenue)) || 1;
    return (
      <div className="flex items-end justify-between h-48 pt-6">
        {data.map(h => {
          const heightPct = (h.revenue / maxVal) * 100;
          return (
            <div key={h.hour} className="flex flex-col items-center flex-1 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow-md z-10 whitespace-nowrap">
                {h.hour.toString().padStart(2, '0')}:00 - ${h.revenue.toFixed(2)}
              </div>
              <div className="w-full bg-slate-100 rounded-t-md h-40 flex items-end">
                <div 
                  className="w-full bg-brand-blue-500 hover:bg-brand-blue-600 rounded-t-md transition-all cursor-pointer"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-400 mt-2">{h.hour}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper to render SVG Donut Chart for Payment Methods
  const renderPaymentDonut = (methods: { [key: string]: number }) => {
    const total = Object.values(methods).reduce((acc, v) => acc + v, 0) || 1;
    let accumulatedPercent = 0;

    const slices = Object.entries(methods).map(([method, val]) => {
      const pct = (val / total) * 100;
      const start = accumulatedPercent;
      accumulatedPercent += pct;
      return { method, pct, start };
    });

    const colors: { [key: string]: string } = {
      CASH: '#10b981', // emerald
      UPI: '#06b6d4',  // cyan
      CARD: '#3b82f6', // blue
      SPLIT: '#f59e0b' // amber
    };

    return (
      <div className="flex flex-col md:flex-row items-center gap-6 justify-around pt-4">
        {/* SVG Circle */}
        <div className="relative w-40 h-40">
          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
            {slices.map((slice, idx) => {
              const strokeDash = `${slice.pct} ${100 - slice.pct}`;
              const strokeOffset = 100 - slice.start;
              return (
                <circle
                  key={idx}
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="transparent"
                  stroke={colors[slice.method] || '#cbd5e1'}
                  strokeWidth="3.8"
                  strokeDasharray={strokeDash}
                  strokeDashoffset={strokeOffset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Sales</span>
            <span className="text-sm font-extrabold text-slate-800">₹{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Legends */}
        <div className="space-y-2 text-xs">
          {slices.map((slice, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[slice.method] }} />
              <span className="font-medium text-slate-700">{slice.method}</span>
              <span className="text-slate-400">({slice.pct.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-brand-blue-600" />
            Executive Business Intelligence
          </h1>
          <p className="text-slate-500 text-sm mt-1">Real-time executive KPIs, sales trends, and working capital analytics</p>
        </div>
      </div>

      {isKpisLoading || isAnalyticsLoading ? (
        <div className="text-center py-12 text-slate-400">Loading business intelligence dashboard...</div>
      ) : (
        <>
          {/* Executive KPIs Grid */}
          {kpis && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Today Revenue */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Today's Revenue</span>
                  <DollarSign className="h-4 w-4 text-brand-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{kpis.today.revenue.toFixed(2)}</h3>
                <div className="flex items-center gap-1.5 mt-2">
                  {formatTrend(kpis.today.revenueTrend)}
                  <span className="text-[10px] text-slate-400">vs yesterday</span>
                </div>
              </div>

              {/* MTD Revenue */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400 uppercase">MTD Revenue</span>
                  <ShoppingBag className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{kpis.mtd.revenue.toFixed(2)}</h3>
                <div className="flex items-center gap-1.5 mt-2">
                  {formatTrend(kpis.mtd.revenueTrend)}
                  <span className="text-[10px] text-slate-400">vs last month MTD</span>
                </div>
              </div>

              {/* MTD Gross Margin */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400 uppercase">MTD Gross Margin</span>
                  <Layers className="h-4 w-4 text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">{kpis.mtd.margin.toFixed(1)}%</h3>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={`text-xs font-semibold ${kpis.mtd.marginTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {kpis.mtd.marginTrend >= 0 ? '+' : ''}{kpis.mtd.marginTrend.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400">absolute variance</span>
                </div>
              </div>

              {/* Working Capital */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Net Working Capital</span>
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{kpis.workingCapital.netWorkingCapital.toFixed(2)}</h3>
                <p className="text-[10px] text-slate-400 mt-2">Receivables + Stock - Payables</p>
              </div>
            </div>
          )}

          {/* Working Capital Breakdown */}
          {kpis && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-800">Working Capital Assets vs Liabilities</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Receivables */}
                <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Customer Receivables</span>
                    <h4 className="text-lg font-extrabold text-slate-800 mt-1">₹{kpis.workingCapital.receivables.toFixed(2)}</h4>
                  </div>
                  <ArrowDownLeft className="h-8 w-8 text-emerald-600 bg-emerald-100/50 p-1.5 rounded-xl" />
                </div>

                {/* Inventory Asset */}
                <div className="p-4 bg-blue-50/20 border border-blue-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Inventory Cost Asset</span>
                    <h4 className="text-lg font-extrabold text-slate-800 mt-1">₹{kpis.workingCapital.inventoryCost.toFixed(2)}</h4>
                  </div>
                  <Layers className="h-8 w-8 text-blue-600 bg-blue-100/50 p-1.5 rounded-xl" />
                </div>

                {/* Payables */}
                <div className="p-4 bg-rose-50/20 border border-rose-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Supplier Payables</span>
                    <h4 className="text-lg font-extrabold text-slate-800 mt-1">₹{kpis.workingCapital.payables.toFixed(2)}</h4>
                  </div>
                  <ArrowUpRight className="h-8 w-8 text-rose-600 bg-rose-100/50 p-1.5 rounded-xl" />
                </div>
              </div>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Sales */}
            {analytics && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-brand-blue-600" />
                  Hourly Trading Peaks
                </h4>
                {renderHourlyChart(analytics.hourlySales)}
              </div>
            )}

            {/* Payment Methods Donut */}
            {analytics && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <PieChart className="h-4 w-4 text-brand-blue-600" />
                  Payment Method Distribution
                </h4>
                {renderPaymentDonut(analytics.paymentMethods)}
              </div>
            )}
          </div>

          {/* Basket Size Stats */}
          {analytics && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800">Basket Size & Checkout Volume</h4>
                <div className="flex gap-4 text-xs font-semibold text-slate-600">
                  <span>Total Items Sold: {analytics.basketSummary.totalItemsSold}</span>
                  <span>Average Basket Size: {analytics.basketSummary.averageBasketSize.toFixed(1)} Items</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {analytics.basketSizes.map((b, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs space-y-1">
                    <span className="text-slate-400 font-bold uppercase">{b.size}</span>
                    <h5 className="text-base font-extrabold text-slate-800">{b.count} Bills</h5>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default ExecutiveBI;
