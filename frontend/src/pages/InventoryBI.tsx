import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api.js';
import { 
  TrendingUp, 
  AlertTriangle, 
  TrendingDown, 
  Layers, 
  Sparkles, 
  Calendar,
  Clock,
  ArrowRight
} from 'lucide-react';

interface AbcXyzItem {
  id: string;
  name: string;

  class: string;
  revenue: number;
  salesQty: number;
}

interface ReorderItem {
  productId: string;
  productName: string;

  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  reorderLevel: number;
  suggestedReorderQty: number;
}

interface InventoryIntelligenceData {
  abcXyz: AbcXyzItem[];
  ageing: {
    bucket0to30: number;
    bucket31to90: number;
    bucket91to180: number;
    bucket180plus: number;
  };
  expiry: {
    expired: number;
    expiring0to30: number;
    expiring31to90: number;
    safe: number;
  };
  velocity: {
    fast: AbcXyzItem[];
    slow: AbcXyzItem[];
    dead: AbcXyzItem[];
  };
  stockSummary: {
    understockCount: number;
    overstockCount: number;
    totalProductsCount: number;
  };
  reorders: ReorderItem[];
}

export const InventoryBI: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'ageing' | 'velocity' | 'reorders'>('matrix');

  // Fetch Inventory Intelligence
  const { data: intel, isLoading } = useQuery<InventoryIntelligenceData>({
    queryKey: ['inventory-intelligence-bi'],
    queryFn: async () => {
      const res = await api.get('/bi/inventory-intelligence');
      return res.data.data;
    },
  });

  const getRecommendation = (cls: string) => {
    switch (cls) {
      case 'AX': return 'Critical item (High value, Steady demand). Maintain tight daily control and optimal safety stock.';
      case 'AY': return 'High value, variable demand. Keep safety buffers and review levels weekly.';
      case 'AZ': return 'High value, sporadic demand. Order on demand or maintain minimal shelf stock.';
      case 'BX':
      case 'BY':
      case 'BZ': return 'Moderate priority. Use standard automated reorder points.';
      case 'CX':
      case 'CY': return 'Low value, steady demand. Auto-reorder in bulk to minimize transaction costs.';
      case 'CZ': return 'Dead/Low-priority item. Order strictly on demand, minimize stock holdings.';
      default: return 'Standard inventory control.';
    }
  };

  const getAgeingTotal = () => {
    if (!intel) return 1;
    return intel.ageing.bucket0to30 + intel.ageing.bucket31to90 + intel.ageing.bucket91to180 + intel.ageing.bucket180plus || 1;
  };

  const getExpiryTotal = () => {
    if (!intel) return 1;
    return intel.expiry.expired + intel.expiry.expiring0to30 + intel.expiry.expiring31to90 + intel.expiry.safe || 1;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-brand-blue-600" />
            Inventory Intelligence & Ageing
          </h1>
          <p className="text-slate-500 text-sm mt-1">ABC/XYZ demand matrices, FIFO stock ageing, and smart reorder analytics</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading inventory intelligence...</div>
      ) : intel && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">Understocked Items</span>
                <h3 className="text-2xl font-bold text-rose-600 mt-2">{intel.stockSummary.understockCount} Items</h3>
              </div>
              <AlertTriangle className="h-8 w-8 text-rose-600 bg-rose-50 p-1.5 rounded-xl" />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">Overstocked Items</span>
                <h3 className="text-2xl font-bold text-amber-600 mt-2">{intel.stockSummary.overstockCount} Items</h3>
              </div>
              <Layers className="h-8 w-8 text-amber-600 bg-amber-50 p-1.5 rounded-xl" />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">Total Catalog Products</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">{intel.stockSummary.totalProductsCount} Products</h3>
              </div>
              <Layers className="h-8 w-8 text-slate-600 bg-slate-50 p-1.5 rounded-xl" />
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveSubTab('matrix')}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
                activeSubTab === 'matrix'
                  ? 'border-brand-blue-600 text-brand-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              ABC/XYZ Demand Matrix
            </button>
            <button
              onClick={() => setActiveSubTab('ageing')}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
                activeSubTab === 'ageing'
                  ? 'border-brand-blue-600 text-brand-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              FIFO Ageing & Expiry
            </button>
            <button
              onClick={() => setActiveSubTab('velocity')}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
                activeSubTab === 'velocity'
                  ? 'border-brand-blue-600 text-brand-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Stock Velocity (Fast/Slow/Dead)
            </button>
            <button
              onClick={() => setActiveSubTab('reorders')}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
                activeSubTab === 'reorders'
                  ? 'border-brand-blue-600 text-brand-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Reorder Advisor ({intel.reorders.length})
            </button>
          </div>

          {/* ABC/XYZ MATRIX */}
          {activeSubTab === 'matrix' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-800">ABC/XYZ Product Classifications</h4>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <th className="py-3 px-4">Product Name</th>

                      <th className="py-3 px-4 text-center">Class</th>
                      <th className="py-3 px-4 text-right">30D Sales Qty</th>
                      <th className="py-3 px-4 text-right">30D Revenue</th>
                      <th className="py-3 px-4">Strategic Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {intel.abcXyz.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>

                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold border rounded-full ${
                            item.class.startsWith('A') ? 'bg-rose-50 text-rose-700 border-rose-100' : 
                            item.class.startsWith('B') ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                            'bg-slate-50 text-slate-700 border-slate-100'
                          }`}>
                            {item.class}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold">{item.salesQty}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">₹{item.revenue.toFixed(2)}</td>
                        <td className="py-3 px-4 text-slate-500 font-medium">{getRecommendation(item.class)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FIFO AGEING & EXPIRY */}
          {activeSubTab === 'ageing' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stock Ageing */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-brand-blue-600" />
                  Stock Ageing Analysis (Value)
                </h4>
                <div className="space-y-4">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>0 - 30 Days (Fast)</span>
                      <span className="font-bold">₹{intel.ageing.bucket0to30.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full" 
                        style={{ width: `${(intel.ageing.bucket0to30 / getAgeingTotal()) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>31 - 90 Days</span>
                      <span className="font-bold">₹{intel.ageing.bucket31to90.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${(intel.ageing.bucket31to90 / getAgeingTotal()) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>91 - 180 Days (Slow)</span>
                      <span className="font-bold">₹{intel.ageing.bucket91to180.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full" 
                        style={{ width: `${(intel.ageing.bucket91to180 / getAgeingTotal()) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>180+ Days (Dead Stock Risk)</span>
                      <span className="font-bold">₹{intel.ageing.bucket180plus.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full" 
                        style={{ width: `${(intel.ageing.bucket180plus / getAgeingTotal()) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expiry Analysis */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-brand-blue-600" />
                  Wastage & Expiry Analysis (Value)
                </h4>
                <div className="space-y-4">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Expired (Immediate Loss)</span>
                      <span className="font-bold text-rose-600">₹{intel.expiry.expired.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-600 rounded-full" 
                        style={{ width: `${(intel.expiry.expired / getExpiryTotal()) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Expiring in 0 - 30 Days (High Risk)</span>
                      <span className="font-bold text-amber-600">₹{intel.expiry.expiring0to30.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full" 
                        style={{ width: `${(intel.expiry.expiring0to30 / getExpiryTotal()) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Expiring in 31 - 90 Days</span>
                      <span className="font-bold text-blue-600">₹{intel.expiry.expiring31to90.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${(intel.expiry.expiring31to90 / getExpiryTotal()) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Safe / Non-Perishable</span>
                      <span className="font-bold text-emerald-600">₹{intel.expiry.safe.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full" 
                        style={{ width: `${(intel.expiry.safe / getExpiryTotal()) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STOCK VELOCITY */}
          {activeSubTab === 'velocity' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Fast Moving */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 text-emerald-600">
                  <TrendingUp className="h-4 w-4" />
                  Fast Moving (Top 10)
                </h4>
                <div className="space-y-3">
                  {intel.velocity.fast.length === 0 ? (
                    <p className="text-slate-400 text-xs">No fast moving items.</p>
                  ) : (
                    intel.velocity.fast.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-xs">
                        <div>
                          <span className="block font-bold text-slate-800">{item.name}</span>

                        </div>
                        <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                          {item.salesQty} sold
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Slow Moving */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 text-amber-600">
                  <Layers className="h-4 w-4" />
                  Slow Moving (Top 10)
                </h4>
                <div className="space-y-3">
                  {intel.velocity.slow.length === 0 ? (
                    <p className="text-slate-400 text-xs">No slow moving items.</p>
                  ) : (
                    intel.velocity.slow.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-xs">
                        <div>
                          <span className="block font-bold text-slate-800">{item.name}</span>

                        </div>
                        <span className="font-extrabold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                          {item.salesQty} sold
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Dead Stock */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 text-rose-600">
                  <TrendingDown className="h-4 w-4" />
                  Dead Stock (Zero Sales)
                </h4>
                <div className="space-y-3">
                  {intel.velocity.dead.length === 0 ? (
                    <p className="text-slate-400 text-xs">No dead stock items.</p>
                  ) : (
                    intel.velocity.dead.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                        <div>
                          <span className="block font-bold text-slate-800">{item.name}</span>

                        </div>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          0 sold
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REORDER ADVISOR */}
          {activeSubTab === 'reorders' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-800">Smart Reorder Suggestions</h4>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <th className="py-3 px-4">Product Name</th>

                      <th className="py-3 px-4">Warehouse</th>
                      <th className="py-3 px-4 text-center">Current Stock</th>
                      <th className="py-3 px-4 text-center">Reorder Level</th>
                      <th className="py-3 px-4 text-center">Suggested Order Qty</th>
                      <th className="py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {intel.reorders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 font-semibold">
                          All products are sufficiently stocked. No reorder suggestions.
                        </td>
                      </tr>
                    ) : (
                      intel.reorders.map((item) => (
                        <tr key={item.productId}>
                          <td className="py-3 px-4 font-bold text-slate-900">{item.productName}</td>

                          <td className="py-3 px-4 text-slate-500">{item.warehouseName}</td>
                          <td className="py-3 px-4 text-center font-bold text-rose-600 bg-rose-50/30">{item.currentStock}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-500">{item.reorderLevel}</td>
                          <td className="py-3 px-4 text-center font-bold text-brand-blue-600 bg-brand-blue-50/20">
                            {item.suggestedReorderQty}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => alert(`Redirecting to Procurement to draft PO for ${item.productName} (${item.suggestedReorderQty} units)`)}
                              className="flex items-center gap-1 text-brand-blue-600 hover:text-brand-blue-700 font-bold transition-all cursor-pointer"
                            >
                              Draft PO
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default InventoryBI;
