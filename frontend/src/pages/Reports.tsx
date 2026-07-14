import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api.js';
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  Percent, 
  Calendar, 
  Download, 
  Printer, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';

interface SalesSummary {
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalTransactions: number;
  averageOrderValue: number;
}

interface TopProduct {
  name: string;

  quantity: number;
  revenue: number;
}

interface SalesReportData {
  summary: SalesSummary;
  paymentMethods: { [key: string]: number };
  topProducts: TopProduct[];
  categorySales: { [key: string]: number };
}

interface WarehouseValuation {
  name: string;
  value: number;
  count: number;
}

interface LowStockItem {
  productId: string;
  productName: string;

  warehouseName: string;
  quantity: number;
  reorderLevel: number;
}

interface StockMovement {
  id: string;
  createdAt: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  product: { name: string; };
  warehouse: { name: string };
  user: { username: string } | null;
}

interface InventoryReportData {
  valuation: {
    totalFifoValue: number;
    warehouses: WarehouseValuation[];
  };
  lowStockCount: number;
  lowStockItems: LowStockItem[];
  recentMovements: StockMovement[];
}

interface TaxItem {
  rate: number;
  taxableAmount: number;
  gstAmount: number;
}

interface TaxReportData {
  outputTax: TaxItem[];
  inputTax: TaxItem[];
  netTaxPayable: number;
  totalOutputGst: number;
  totalInputGst: number;
}

interface CashFlowTx {
  id: string;
  date: string;
  type: 'CASH_IN' | 'CASH_OUT';
  amount: number;
  description: string | null;
  cashier: string;
}

interface FinancialReportData {
  ledgerSummary: {
    totalReceivables: number;
    totalPayables: number;
    netOutstanding: number;
  };
  cashFlow: {
    totalCashIn: number;
    totalCashOut: number;
    netCashFlow: number;
    transactions: CashFlowTx[];
  };
}

export const Reports: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'tax' | 'financial'>('sales');

  // Date Range Filter
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch Reports
  const { data: salesData, isLoading: isSalesLoading } = useQuery<SalesReportData>({
    queryKey: ['reports-sales', startDate, endDate],
    queryFn: async () => {
      const res = await api.get('/reports/sales', { params: { startDate, endDate } });
      return res.data.data;
    },
    enabled: activeTab === 'sales',
  });

  const { data: inventoryData, isLoading: isInventoryLoading } = useQuery<InventoryReportData>({
    queryKey: ['reports-inventory'],
    queryFn: async () => {
      const res = await api.get('/reports/inventory');
      return res.data.data;
    },
    enabled: activeTab === 'inventory',
  });

  const { data: taxData, isLoading: isTaxLoading } = useQuery<TaxReportData>({
    queryKey: ['reports-tax', startDate, endDate],
    queryFn: async () => {
      const res = await api.get('/reports/tax', { params: { startDate, endDate } });
      return res.data.data;
    },
    enabled: activeTab === 'tax',
  });

  const { data: financialData, isLoading: isFinancialLoading } = useQuery<FinancialReportData>({
    queryKey: ['reports-financial', startDate, endDate],
    queryFn: async () => {
      const res = await api.get('/reports/financial', { params: { startDate, endDate } });
      return res.data.data;
    },
    enabled: activeTab === 'financial',
  });

  // Client-side CSV Exporter
  const handleExportCSV = () => {
    let csvContent = '';
    const filename = `Report-${activeTab}-${startDate}-to-${endDate}.csv`;

    if (activeTab === 'sales' && salesData) {
      csvContent = 'Category,Revenue (₹)\n';
      Object.entries(salesData.categorySales).forEach(([cat, rev]) => {
        csvContent += `"${cat}",${rev.toFixed(2)}\n`;
      });
      csvContent += '\nTop Products,Quantity Sold,Revenue (₹)\n';
      salesData.topProducts.forEach(p => {
        csvContent += `"${p.name}",${p.quantity},${p.revenue.toFixed(2)}\n`;
      });
    } else if (activeTab === 'inventory' && inventoryData) {
      csvContent = 'Warehouse,Valuation (₹),Stock Count\n';
      inventoryData.valuation.warehouses.forEach(w => {
        csvContent += `"${w.name}",${w.value.toFixed(2)},${w.count}\n`;
      });
      csvContent += '\nLow Stock Item,Warehouse,Quantity,Reorder Level\n';
      inventoryData.lowStockItems.forEach(item => {
        csvContent += `"${item.productName}","${item.warehouseName}",${item.quantity},${item.reorderLevel}\n`;
      });
    } else if (activeTab === 'tax' && taxData) {
      csvContent = 'GST Rate (%),Taxable Sales (₹),Output GST (₹),Taxable Purchases (₹),Input GST (₹)\n';
      const rates = [5, 12, 18, 28];
      rates.forEach(rate => {
        const outTax = taxData.outputTax.find(t => t.rate === rate) || { taxableAmount: 0, gstAmount: 0 };
        const inTax = taxData.inputTax.find(t => t.rate === rate) || { taxableAmount: 0, gstAmount: 0 };
        csvContent += `${rate},${outTax.taxableAmount.toFixed(2)},${outTax.gstAmount.toFixed(2)},${inTax.taxableAmount.toFixed(2)},${inTax.gstAmount.toFixed(2)}\n`;
      });
    } else if (activeTab === 'financial' && financialData) {
      csvContent = 'Posting Date,Cash Flow Type,Amount (₹),Description,Cashier\n';
      financialData.cashFlow.transactions.forEach(tx => {
        csvContent += `"${new Date(tx.date).toLocaleString()}","${tx.type}",${tx.amount.toFixed(2)},"${tx.description || ''}","${tx.cashier}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-brand-blue-600" />
            Operational Reports & GST Filings
          </h1>
          <p className="text-slate-500 text-sm mt-1">Generate GSTR-1 tax reports, inventory valuation, and cash flow ledgers</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters (hidden on print) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center print:hidden">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Calendar className="h-4 w-4 text-slate-400" />
          Date Range:
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none"
          />
        </div>
      </div>

      {/* Tabs (hidden on print) */}
      <div className="flex border-b border-slate-200 print:hidden">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'sales'
              ? 'border-brand-blue-600 text-brand-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Sales & Revenue
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'inventory'
              ? 'border-brand-blue-600 text-brand-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Inventory Valuation
        </button>
        <button
          onClick={() => setActiveTab('tax')}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'tax'
              ? 'border-brand-blue-600 text-brand-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          GST Tax Filings
        </button>
        <button
          onClick={() => setActiveTab('financial')}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'financial'
              ? 'border-brand-blue-600 text-brand-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Cash Flow & Ledgers
        </button>
      </div>

      {/* SALES & REVENUE TAB */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {isSalesLoading ? (
            <div className="text-center py-12 text-slate-400">Loading sales analytics...</div>
          ) : salesData && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Total Revenue</span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{salesData.summary.totalRevenue.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">GST Collected</span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{salesData.summary.totalTax.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Total Discounts</span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{salesData.summary.totalDiscount.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Average Order Value</span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{salesData.summary.averageOrderValue.toFixed(2)}</h3>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-brand-blue-600" />
                    Revenue by Category
                  </h4>
                  <div className="space-y-3 pt-2">
                    {Object.entries(salesData.categorySales).map(([cat, rev]) => (
                      <div key={cat} className="space-y-1 text-xs">
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>{cat}</span>
                          <span>₹{rev.toFixed(2)}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand-blue-500 rounded-full" 
                            style={{ width: `${salesData.summary.totalRevenue > 0 ? (rev / salesData.summary.totalRevenue) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Selling Products */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-brand-blue-600" />
                    Top 10 Selling Products
                  </h4>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100">
                          <th className="py-2">Product Name</th>
                          <th className="py-2 text-center">Qty Sold</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {salesData.topProducts.map((p, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 font-semibold text-slate-900">{p.name}</td>
                            <td className="py-2.5 text-center font-bold text-slate-500">{p.quantity}</td>
                            <td className="py-2.5 text-right font-bold text-slate-900">₹{p.revenue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* INVENTORY VALUATION TAB */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {isInventoryLoading ? (
            <div className="text-center py-12 text-slate-400">Loading inventory valuation...</div>
          ) : inventoryData && (
            <>
              {/* Summary Valuation */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Total Inventory Asset Valuation (FIFO Cost)</span>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                    ${inventoryData.valuation.totalFifoValue.toFixed(2)}
                  </h2>
                </div>
                <div className="flex gap-4">
                  {inventoryData.valuation.warehouses.map(w => (
                    <div key={w.name} className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                      <span className="block text-slate-400 font-bold uppercase">{w.name}</span>
                      <span className="font-bold text-slate-800">₹{w.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Low Stock Alerts */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    Low Stock Alerts ({inventoryData.lowStockCount} Items)
                  </h4>
                  <div className="overflow-x-auto text-xs max-h-80 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100">
                          <th className="py-2">Product Name</th>
                          <th className="py-2">Warehouse</th>
                          <th className="py-2 text-center">Current Stock</th>
                          <th className="py-2 text-center">Reorder Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {inventoryData.lowStockItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 font-semibold text-slate-900">{item.productName}</td>
                            <td className="py-2.5 text-slate-500">{item.warehouseName}</td>
                            <td className="py-2.5 text-center font-bold text-rose-600 bg-rose-50/50">{item.quantity}</td>
                            <td className="py-2.5 text-center font-bold text-slate-500">{item.reorderLevel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Movement Transactions */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800">Recent Stock Movement Transactions</h4>
                  <div className="overflow-x-auto text-xs max-h-80 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100">
                          <th className="py-2">Date</th>
                          <th className="py-2">Product</th>
                          <th className="py-2 text-center">Quantity</th>
                          <th className="py-2">Type</th>
                          <th className="py-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {inventoryData.recentMovements.map((movement) => (
                          <tr key={movement.id}>
                            <td className="py-2.5 text-slate-500">{new Date(movement.createdAt).toLocaleDateString()}</td>
                            <td className="py-2.5 font-semibold text-slate-900">{movement.product.name}</td>
                            <td className={`py-2.5 text-center font-bold ${movement.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                            </td>
                            <td className="py-2.5 font-semibold text-slate-500">{movement.type}</td>
                            <td className="py-2.5 text-slate-500 max-w-[120px] truncate" title={movement.reason || ''}>
                              {movement.reason || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* GST TAX FILINGS TAB */}
      {activeTab === 'tax' && (
        <div className="space-y-6">
          {isTaxLoading ? (
            <div className="text-center py-12 text-slate-400">Loading GST tax reports...</div>
          ) : taxData && (
            <>
              {/* Net Tax Summary */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Net GST Payable / (Credit Refundable)</span>
                  <h2 className={`text-3xl font-extrabold tracking-tight mt-1 ${taxData.netTaxPayable >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ${taxData.netTaxPayable.toFixed(2)}
                  </h2>
                </div>
                <div className="flex gap-4">
                  <div className="px-4 py-2.5 bg-rose-50 border border-rose-100 rounded-xl text-xs">
                    <span className="block text-rose-500 font-bold uppercase">Output GST (Collected on Sales)</span>
                    <span className="font-bold text-rose-800">₹{taxData.totalOutputGst.toFixed(2)}</span>
                  </div>
                  <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs">
                    <span className="block text-emerald-500 font-bold uppercase">Input GST (Paid on Purchases - ITC)</span>
                    <span className="font-bold text-emerald-800">₹{taxData.totalInputGst.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* GST Rate-wise Breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Output GST collected */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Percent className="h-4 w-4 text-rose-500" />
                    Output GST Registry (Sales GSTR-1)
                  </h4>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100">
                          <th className="py-2">GST Rate (%)</th>
                          <th className="py-2 text-right">Taxable Sales Amount</th>
                          <th className="py-2 text-right">GST Collected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {taxData.outputTax.map((t, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 font-bold text-slate-800">{t.rate}%</td>
                            <td className="py-2.5 text-right font-medium">₹{t.taxableAmount.toFixed(2)}</td>
                            <td className="py-2.5 text-right font-bold text-rose-600">₹{t.gstAmount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Input GST paid */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Percent className="h-4 w-4 text-emerald-500" />
                    Input Tax Credit (Purchases GSTR-2)
                  </h4>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100">
                          <th className="py-2">Estimated GST Rate (%)</th>
                          <th className="py-2 text-right">Taxable Purchase Amount</th>
                          <th className="py-2 text-right">GST Paid (ITC)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {taxData.inputTax.map((t, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 font-bold text-slate-800">{t.rate}%</td>
                            <td className="py-2.5 text-right font-medium">₹{t.taxableAmount.toFixed(2)}</td>
                            <td className="py-2.5 text-right font-bold text-emerald-600">₹{t.gstAmount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CASH FLOW & LEDGERS TAB */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          {isFinancialLoading ? (
            <div className="text-center py-12 text-slate-400">Loading financial statements...</div>
          ) : financialData && (
            <>
              {/* Ledger Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Customer Receivables (Outstanding Credit)</span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{financialData.ledgerSummary.totalReceivables.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Supplier Payables (Outstanding AP)</span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">₹{financialData.ledgerSummary.totalPayables.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Net Working Capital Balance</span>
                  <h3 className={`text-2xl font-bold mt-2 ${financialData.ledgerSummary.netOutstanding >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ${financialData.ledgerSummary.netOutstanding.toFixed(2)}
                  </h3>
                </div>
              </div>

              {/* Cash Flow Timeline */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-800">Cash Flow Timeline (Register Drops & Payouts)</h4>
                  <div className="flex gap-4 text-xs">
                    <span className="text-emerald-600 font-semibold">Total Cash In: +${financialData.cashFlow.totalCashIn.toFixed(2)}</span>
                    <span className="text-rose-600 font-semibold">Total Cash Out: -${financialData.cashFlow.totalCashOut.toFixed(2)}</span>
                    <span className="font-bold text-slate-800">Net Cash Flow: ${financialData.cashFlow.netCashFlow.toFixed(2)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto text-xs max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4">Cashier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {financialData.cashFlow.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">No cash transactions in this date range.</td>
                        </tr>
                      ) : (
                        financialData.cashFlow.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-3 px-4 text-slate-500">{new Date(tx.date).toLocaleString()}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${
                                tx.type === 'CASH_IN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                              }`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-950">
                              {tx.type === 'CASH_IN' ? (
                                <span className="text-emerald-600 flex items-center justify-end gap-0.5">
                                  <ArrowDownLeft className="h-3 w-3" />
                                  +${tx.amount.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-rose-600 flex items-center justify-end gap-0.5">
                                  <ArrowUpRight className="h-3 w-3" />
                                  -${tx.amount.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{tx.description || 'N/A'}</td>
                            <td className="py-3 px-4 text-slate-500">{tx.cashier}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
export default Reports;
