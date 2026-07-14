import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api.js';
import { 
  TrendingUp, 
  Layers, 
  Activity, 
  AlertTriangle, 
  Search, 
  Calendar, 
  DollarSign, 
  Package,
  ArrowRight
} from 'lucide-react';

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface CategoryValuation {
  categoryId: string;
  categoryName: string;
  value: number;
  count: number;
}

interface ValuationData {
  totalValuation: number;
  totalItemsCount: number;
  uniqueProductsCount: number;
  categoryBreakdown: CategoryValuation[];
}

interface FifoLayer {
  id: string;
  productId: string;
  product: {
    name: string;

    barcode: string;
  };
  warehouseId: string;
  warehouse: {
    name: string;
    code: string;
  };
  batchNumber: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  manufacturingDate: string | null;
  originalQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  landedCost: number;
  createdAt: string;
  ageInDays: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

interface FifoConsumption {
  id: string;
  productId: string;
  product: {
    name: string;

  };
  warehouse: {
    name: string;
  };
  fifoLayer: {
    batchNumber: string | null;
    lotNumber: string | null;
    expiryDate: string | null;
  };
  invoiceItem: {
    invoice: {
      id: string;
      invoiceNumber: string;
    };
  } | null;
  quantityConsumed: number;
  unitCost: number;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const FIFOAnalytics: React.FC = () => {
  // Filters
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [layerSearch, setLayerSearch] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expiring_soon' | 'expired'>('all');
  const [layerPage, setLayerPage] = useState(1);
  const [consumptionPage, setConsumptionPage] = useState(1);

  // Fetch Valuation metrics
  const { data: valuationData, isLoading: isValuationLoading } = useQuery<ValuationData>({
    queryKey: ['fifo-valuation', selectedWarehouseId],
    queryFn: async () => {
      const res = await api.get('/fifo/valuation', {
        params: { warehouseId: selectedWarehouseId || undefined },
      });
      return res.data.data;
    },
  });

  // Fetch Cost Layers
  const { data: layersData, isLoading: isLayersLoading } = useQuery<{ data: FifoLayer[]; pagination: Pagination }>({
    queryKey: ['fifo-layers', selectedWarehouseId, layerSearch, expiryFilter, layerPage],
    queryFn: async () => {
      const res = await api.get('/fifo/layers', {
        params: {
          page: layerPage,
          limit: 8,
          warehouseId: selectedWarehouseId || undefined,
          expiryStatus: expiryFilter,
          search: layerSearch || undefined,
        },
      });
      return res.data;
    },
  });

  // Fetch Consumptions
  const { data: consumptionsData, isLoading: isConsumptionsLoading } = useQuery<{ data: FifoConsumption[]; pagination: Pagination }>({
    queryKey: ['fifo-consumptions', consumptionPage],
    queryFn: async () => {
      const res = await api.get('/fifo/consumptions', {
        params: { page: consumptionPage, limit: 8 },
      });
      return res.data;
    },
  });

  // Fetch Warehouses
  const { data: warehousesData } = useQuery<Warehouse[]>({
    queryKey: ['fifo-warehouses'],
    queryFn: async () => {
      const res = await api.get('/inventory/warehouses');
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-emerald-600" />
            FIFO Inventory Valuation & Costing
          </h1>
          <p className="text-slate-500 text-sm mt-1">Trace batch costs, Cost of Goods Sold (COGS), and inventory aging</p>
        </div>

        <div>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm font-semibold outline-none transition-all"
          >
            <option value="">All Warehouses</option>
            {warehousesData?.map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Dashboard */}
      {isValuationLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Valuation */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Inventory Value (FIFO)</span>
              <h2 className="text-3xl font-bold text-slate-900">₹{valuationData?.totalValuation?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Asset value based on active cost layers
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>

          {/* Total Items Count */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Stock Quantity</span>
              <h2 className="text-3xl font-bold text-slate-900">{valuationData?.totalItemsCount?.toLocaleString()}</h2>
              <p className="text-xs text-slate-500">Units currently held in warehouses</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
              <Package className="h-6 w-6" />
            </div>
          </div>

          {/* Unique Products */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Products in Stock</span>
              <h2 className="text-3xl font-bold text-slate-900">{valuationData?.uniqueProductsCount}</h2>
              <p className="text-xs text-slate-500">Unique products with active cost layers</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
              <Activity className="h-6 w-6" />
            </div>
          </div>
        </div>
      )}

      {/* Category Valuation Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Category Valuation Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {valuationData?.categoryBreakdown?.map((cat) => {
            const percentage = valuationData.totalValuation > 0
              ? (cat.value / valuationData.totalValuation) * 100
              : 0;
            return (
              <div key={cat.categoryId} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-500 block truncate">{cat.categoryName}</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-lg font-extrabold text-slate-900">₹{cat.value.toLocaleString()}</span>
                  <span className="text-xs font-semibold text-emerald-600">({percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full" 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Cost Layers */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Active Cost Layers Ledger</h3>
            <p className="text-xs text-slate-500 mt-0.5">Active layers with remaining quantity greater than zero</p>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search product..."
                value={layerSearch}
                onChange={(e) => {
                  setLayerSearch(e.target.value);
                  setLayerPage(1);
                }}
                className="pl-9 pr-4 py-2 w-full border border-slate-200 focus:border-emerald-500 rounded-xl text-xs outline-none"
              />
            </div>

            {/* Expiry Filter */}
            <select
              value={expiryFilter}
              onChange={(e) => {
                setExpiryFilter(e.target.value as 'all' | 'expiring_soon' | 'expired');
                setLayerPage(1);
              }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none"
            >
              <option value="all">All Layers</option>
              <option value="expiring_soon">Expiring Soon (&lt; 30 Days)</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                <th className="py-4 px-6">Product</th>
                <th className="py-4 px-6">Warehouse</th>
                <th className="py-4 px-6">Batch / Lot</th>
                <th className="py-4 px-6">Expiry Date</th>
                <th className="py-4 px-6 text-center">Remaining / Original</th>
                <th className="py-4 px-6 text-right">Unit Cost</th>
                <th className="py-4 px-6 text-right">Total Value</th>
                <th className="py-4 px-6 text-center">Age (Days)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLayersLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading cost layers...</td>
                </tr>
              ) : layersData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No active cost layers found.</td>
                </tr>
              ) : (
                layersData?.data?.map((layer) => (
                  <tr key={layer.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">
                      {layer.product.name}

                    </td>
                    <td className="py-4 px-6 font-medium text-slate-600">{layer.warehouse.name}</td>
                    <td className="py-4 px-6 text-slate-500">{layer.batchNumber || layer.lotNumber || 'Default'}</td>
                    <td className="py-4 px-6">
                      {layer.expiryDate ? (
                        <span className={`flex items-center gap-1 font-semibold ${
                          layer.isExpired ? 'text-rose-600' : layer.isExpiringSoon ? 'text-amber-600' : 'text-slate-700'
                        }`}>
                          {(layer.isExpired || layer.isExpiringSoon) && <AlertTriangle className="h-3.5 w-3.5" />}
                          {new Date(layer.expiryDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-slate-400">No Expiry</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-slate-700">
                      {layer.remainingQuantity} <span className="text-slate-400 font-normal">/ {layer.originalQuantity}</span>
                    </td>
                    <td className="py-4 px-6 text-right font-semibold">₹{layer.unitCost.toFixed(2)}</td>
                    <td className="py-4 px-6 text-right font-bold text-slate-900">
                      ${(layer.remainingQuantity * layer.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-center font-semibold text-slate-600">{layer.ageInDays} days</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {layersData?.pagination && (
          <div className="p-5 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
            <p>Showing Page {layerPage} of {layersData.pagination.totalPages || 1}</p>
            <div className="flex gap-2">
              <button
                disabled={layerPage === 1}
                onClick={() => setLayerPage(p => p - 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={layerPage === layersData.pagination.totalPages}
                onClick={() => setLayerPage(p => p + 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FIFO Consumption Timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Activity className="h-4.5 w-4.5 text-emerald-600" />
            Recent FIFO Consumption Timeline (Traceability)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Real-time stock consumption log tracing back to specific batch layers</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                <th className="py-4 px-6">Timestamp</th>
                <th className="py-4 px-6">Product</th>
                <th className="py-4 px-6">Source Doc</th>
                <th className="py-4 px-6">Batch / Lot Used</th>
                <th className="py-4 px-6 text-center">Qty Consumed</th>
                <th className="py-4 px-6 text-right">Cost Price</th>
                <th className="py-4 px-6 text-right">Total Cost (COGS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isConsumptionsLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading consumption records...</td>
                </tr>
              ) : consumptionsData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No consumption logs recorded.</td>
                </tr>
              ) : (
                consumptionsData?.data?.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-slate-500 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-900">
                      {c.product.name}

                    </td>
                    <td className="py-4 px-6">
                      {c.invoiceItem?.invoice ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded-md">
                          {c.invoiceItem.invoice.invoiceNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">Adjustment / Return</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-600">{c.fifoLayer.batchNumber || c.fifoLayer.lotNumber || 'Default'}</td>
                    <td className="py-4 px-6 text-center font-bold text-slate-800 flex items-center justify-center gap-1">
                      {c.quantityConsumed}
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                    </td>
                    <td className="py-4 px-6 text-right font-semibold">₹{c.unitCost.toFixed(2)}</td>
                    <td className="py-4 px-6 text-right font-bold text-slate-900">₹{(c.quantityConsumed * c.unitCost).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {consumptionsData?.pagination && (
          <div className="p-5 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
            <p>Showing Page {consumptionPage} of {consumptionsData.pagination.totalPages || 1}</p>
            <div className="flex gap-2">
              <button
                disabled={consumptionPage === 1}
                onClick={() => setConsumptionPage(p => p - 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={consumptionPage === consumptionsData.pagination.totalPages}
                onClick={() => setConsumptionPage(p => p + 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default FIFOAnalytics;
