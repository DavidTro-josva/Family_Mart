import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  AlertTriangle, 
  History, 
  Plus, 
  Loader2,
  X,
  Package,
  Eye,
  Trash2,
  DollarSign,
  Barcode,
  Edit,
  SlidersHorizontal
} from 'lucide-react';
import api from '../services/api.ts';
// --- Type Definitions ---
interface Product {
  id: string;
  name: string;
  barcode: string;

  costPrice: number;
  sellingPrice: number;
  mrp: number;
  unit: { id: string; abbreviation: string };
  subCategory: { id: string; name: string; category: { name: string } };
  brand: { id: string; name: string };
  gstCategory: { id: string; name: string; rate: number };
  supplier: { id: string; name: string };
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface WarehouseStock {
  id: string;
  productId: string;
  productName: string;
  barcode: string;

  quantity: number;
  reorderLevel: number;
  costPrice: number;
  sellingPrice: number;
  binCode: string | null;
}

interface InventoryTransaction {
  id: string;
  productId: string;
  product: Product;
  warehouseId: string;
  warehouse: Warehouse;
  type: 'ADDITION' | 'REMOVAL' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY' | 'SALE' | 'PURCHASE' | 'RETURN';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  createdAt: string;
  user?: { username: string };
}

interface LowStockItem {
  id: string;
  productName: string;
  barcode: string;
  quantity: number;
  reorderLevel: number;
  binCode: string | null;
}

interface AdjustStockPayload {
  productId: string;
  warehouseId: string;
  type: 'ADDITION' | 'REMOVAL' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY';
  quantity: number;
  binCode?: string;
  reason: string;
}

export const Inventory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stock' | 'timeline' | 'low-stock'>('stock');
  const [search, setSearch] = useState('');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // --- Stock Adjustment Form States ---
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [adjustType, setAdjustType] = useState<'ADDITION' | 'REMOVAL' | 'DAMAGE' | 'EXPIRY' | 'ADJUSTMENT'>('ADDITION');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBin, setAdjustBin] = useState('');
  const [adjustFormError, setAdjustFormError] = useState<string | null>(null);

  // --- Add Product Form States ---
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productBarcode, setProductBarcode] = useState('');

  const [productDesc, setProductDesc] = useState('');
  const [productCost, setProductCost] = useState(0);
  const [productSelling, setProductSelling] = useState(0);
  const [productMrp, setProductMrp] = useState(0);
  const [productReorder, setProductReorder] = useState(10);
  const [productUnit, setProductUnit] = useState('');
  const [productSubCat, setProductSubCat] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productGst, setProductGst] = useState('');
  const [productSupplier, setProductSupplier] = useState('');
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // --- Queries ---
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['inventory-dashboard'],
    queryFn: async () => {
      const res = await api.get('/inventory/dashboard');
      return res.data.data;
    }
  });

  const { data: transactionsData, isLoading: isTransactionsLoading } = useQuery({
    queryKey: ['inventory-transactions', page],
    queryFn: async () => {
      const res = await api.get('/inventory/transactions', {
        params: { page, limit: 10 }
      });
      return res.data.data;
    },
    enabled: activeTab === 'timeline'
  });

  // Fetch Master Data for Product Form
  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => (await api.get('/master/units')).data.data.units,
    enabled: isAddProductModalOpen
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/master/categories')).data.data.categories,
    enabled: isAddProductModalOpen
  });
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await api.get('/master/brands')).data.data.brands,
    enabled: isAddProductModalOpen
  });
  const { data: gstCategories } = useQuery({
    queryKey: ['gst-categories'],
    queryFn: async () => (await api.get('/master/gst-categories')).data.data.gstCategories,
    enabled: isAddProductModalOpen
  });
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/master/suppliers')).data.data.suppliers,
    enabled: isAddProductModalOpen
  });
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await api.get('/inventory/warehouses')).data.data.warehouses,
    enabled: isAdjustModalOpen
  });

  // --- Mutations ---
  const adjustMutation = useMutation({
    mutationFn: async (payload: AdjustStockPayload) => {
      const res = await api.post('/inventory/adjust', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      setIsAdjustModalOpen(false);
      resetAdjustForm();
    },
    onError: (err) => {
      const errMsg = (err as any).response?.data?.error?.message || 'Stock adjustment failed.';
      setAdjustFormError(errMsg);
    }
  });

  const addProductMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/master/products', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      setIsAddProductModalOpen(false);
      resetProductForm();
    },
    onError: (err) => {
      const errMsg = (err as any).response?.data?.error?.message || 'Failed to add product.';
      setProductFormError(errMsg);
    }
  });

  const editProductMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
      const res = await api.put(`/master/products/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      setIsAddProductModalOpen(false);
      resetProductForm();
    },
    onError: (err) => {
      const errMsg = (err as any).response?.data?.error?.message || 'Failed to update product.';
      setProductFormError(errMsg);
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/master/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
    }
  });

  const resetAdjustForm = () => {
    setSelectedProductId('');
    setSelectedWarehouseId('');
    setAdjustType('ADDITION');
    setAdjustQty(1);
    setAdjustReason('');
    setAdjustBin('');
    setAdjustFormError(null);
  };

  const handleOpenAdjustStock = (item: any) => {
    resetAdjustForm();
    setSelectedProductId(item.productId);
    setSelectedWarehouseId(warehouses?.[0]?.id || ''); // Auto-select first warehouse if available
    setAdjustType('ADJUSTMENT');
    setAdjustQty(item.quantity);
    setIsAdjustModalOpen(true);
  };

  const resetProductForm = () => {
    setProductName('');
    setProductBarcode('');

    setProductDesc('');
    setProductCost(0);
    setProductSelling(0);
    setProductMrp(0);
    setProductReorder(10);
    setProductUnit('');
    setProductSubCat('');
    setProductBrand('');
    setProductGst('');
    setProductSupplier('');
    setProductFormError(null);
    setEditingProductId(null);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedWarehouseId || !adjustReason) {
      setAdjustFormError('Please fill in all required fields.');
      return;
    }
    adjustMutation.mutate({
      productId: selectedProductId,
      warehouseId: selectedWarehouseId,
      type: adjustType,
      quantity: adjustQty,
      binCode: adjustBin || undefined,
      reason: adjustReason
    });
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !productBarcode || !productUnit || !productSubCat || !productBrand || !productGst || !productSupplier) {
      setProductFormError('Please fill in all required fields.');
      return;
    }
    if (productSelling < productCost) {
      setProductFormError('Selling price must be greater than or equal to cost price.');
      return;
    }
    if (productSelling > productMrp) {
      setProductFormError('Selling price cannot exceed MRP.');
      return;
    }
    const payload = {
      name: productName,
      description: productDesc || undefined,
      barcode: productBarcode,
      costPrice: Number(productCost),
      sellingPrice: Number(productSelling),
      mrp: Number(productMrp),
      reorderLevel: Number(productReorder),
      unitId: productUnit,
      subCategoryId: productSubCat,
      brandId: productBrand,
      gstCategoryId: productGst,
      supplierId: productSupplier
    };
    
    if (editingProductId) {
      editProductMutation.mutate({ id: editingProductId, payload });
    } else {
      addProductMutation.mutate(payload);
    }
  };

  const handleEditProduct = (item: any) => {
    setEditingProductId(item.productId);
    setProductName(item.productName);
    setProductBarcode(item.barcode);
    setProductDesc(item.description || '');
    setProductCost(item.costPrice);
    setProductSelling(item.sellingPrice);
    setProductMrp(item.mrp || item.sellingPrice); // Fallback if mrp isn't in grid directly
    setProductReorder(item.reorderLevel);
    // Note: The following IDs must exist in the grid data, if not they might need fetching
    // Assuming the table item has them or we'll have to fall back
    setProductUnit(item.unitId || '');
    setProductSubCat(item.subCategoryId || '');
    setProductBrand(item.brandId || '');
    setProductGst(item.gstCategoryId || '');
    setProductSupplier(item.supplierId || '');
    setProductFormError(null);
    setIsAddProductModalOpen(true);
  };

  const displayedStocks = dashboardData?.stocks?.filter((s: WarehouseStock) => 
    (s.productName?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (s.barcode || '').includes(search)
  ) || [];

  return (
    <div className="space-y-6">
      {/* Top Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-6">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-800">Stock & Products Engine</h2>
          <p className="text-slate-500 text-sm mt-0.5">Full stock view, catalog management, and stock adjustments.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddProductModalOpen(true)}
            className="btn-primary px-4 py-2 text-sm shrink-0"
          >
            <Plus size={16} />
            <span>Add Product</span>
          </button>
          <button 
            onClick={() => setIsAdjustModalOpen(true)}
            className="btn-secondary px-4 py-2 text-sm shrink-0"
          >
            <Plus size={16} />
            <span>Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      {!isDashboardLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-card p-6 border-l-4 border-l-brand-blue-500">
            <span className="text-xs font-semibold text-slate-400 uppercase">Inventory Cost Value</span>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              ₹{dashboardData?.metrics?.totalCostValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </h3>
            <p className="text-xs text-slate-500 mt-2">Valued at product cost price</p>
          </div>

          <div className="glass-card p-6 border-l-4 border-l-brand-green-500">
            <span className="text-xs font-semibold text-slate-400 uppercase">Est. Selling Value</span>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              ₹{dashboardData?.metrics?.totalSellingValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </h3>
            <p className="text-xs text-slate-500 mt-2">Potential store revenue</p>
          </div>

          <div className="glass-card p-6 border-l-4 border-l-amber-500">
            <span className="text-xs font-semibold text-slate-400 uppercase">Low Stock Alerts</span>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{dashboardData?.metrics?.lowStockCount || 0} Items</h3>
            <p className="text-xs text-amber-600 font-medium mt-2">Breached reorder threshold</p>
          </div>

          <div className="glass-card p-6 border-l-4 border-l-red-500">
            <span className="text-xs font-semibold text-slate-400 uppercase">Out of Stock</span>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{dashboardData?.metrics?.outOfStockCount || 0} Items</h3>
            <p className="text-xs text-red-600 font-medium mt-2">Immediate restock required</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 shadow-sm max-w-md">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'stock' ? 'bg-gradient-to-r from-brand-blue-600 to-brand-blue-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Stock Full View
        </button>
        <button
          onClick={() => setActiveTab('low-stock')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'low-stock' ? 'bg-gradient-to-r from-brand-blue-600 to-brand-blue-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Low Stock
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'timeline' ? 'bg-gradient-to-r from-brand-blue-600 to-brand-blue-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Stock Ledger
        </button>
      </div>

      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="relative max-w-md bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <input 
              type="text"
              placeholder="Search stock by name, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div className="glass-card overflow-hidden">
            {isDashboardLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-brand-blue-600" size={32} />
              </div>
            ) : displayedStocks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No stock found matching search criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <th className="px-6 py-4">Product Name</th>
                      <th className="px-6 py-4">Barcode</th>
                      <th className="px-6 py-4">Cost Price</th>
                      <th className="px-6 py-4">Selling Price</th>
                      <th className="px-6 py-4">Current Stock</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedStocks.map((item: WarehouseStock) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                        <td className="px-6 py-4 font-semibold text-slate-800">{item.productName}</td>
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs">{item.barcode}</div>
                        </td>
                        <td className="px-6 py-4">₹{item.costPrice.toFixed(2)}</td>
                        <td className="px-6 py-4 font-bold text-brand-blue-600">₹{item.sellingPrice.toFixed(2)}</td>
                        <td className={`px-6 py-4 font-bold ${item.quantity <= item.reorderLevel ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleOpenAdjustStock(item)}
                              className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                              title="Adjust Stock"
                            >
                              <SlidersHorizontal size={16} />
                            </button>
                            <button 
                              onClick={() => handleEditProduct(item)}
                              className="p-1.5 hover:bg-brand-blue-50 text-slate-400 hover:text-brand-blue-600 rounded-lg transition-colors"
                              title="Edit Product"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${item.productName}?`)) {
                                  deleteProductMutation.mutate(item.productId);
                                }
                              }}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'low-stock' && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4 text-slate-800">
            <AlertTriangle className="text-amber-500" size={20} />
            <h3 className="font-display font-bold text-base">Low Stock Items</h3>
          </div>
          {dashboardData?.lowStockItems?.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">No low stock items currently. Well stocked!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-400 font-medium border-b border-slate-100">
                    <th className="pb-3">Product Name</th>
                    <th className="pb-3">Barcode</th>
                    <th className="pb-3">Current Stock</th>
                    <th className="pb-3">Reorder Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboardData?.lowStockItems?.map((item: LowStockItem) => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="py-3 font-semibold text-slate-800">{item.productName}</td>
                      <td className="py-3 text-slate-500">{item.barcode}</td>
                      <td className="py-3 text-red-600 font-bold">{item.quantity}</td>
                      <td className="py-3 text-slate-500">{item.reorderLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="glass-card">
          {isTransactionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-brand-blue-600" size={32} />
            </div>
          ) : transactionsData?.transactions?.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No transactions recorded yet.</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100">
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">Product</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Adjustment</th>
                      <th className="px-6 py-4">Balance</th>
                      <th className="px-6 py-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactionsData?.transactions?.map((tx: InventoryTransaction) => {
                      const isQtyPositive = tx.quantity > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                          <td className="px-6 py-4 text-slate-400 text-xs">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            <div>{tx.product.name}</div>
                            <div className="text-xs text-slate-400 font-normal">{tx.product.barcode}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-xs font-semibold
                              ${tx.type === 'SALE' || tx.type === 'REMOVAL' || tx.type === 'DAMAGE' || tx.type === 'EXPIRY'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className={`px-6 py-4 font-bold ${isQtyPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isQtyPositive ? `+${tx.quantity}` : tx.quantity}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {tx.previousStock} → <span className="font-semibold text-slate-800">{tx.newStock}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">{tx.reason || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-slate-100 shadow-2xl rounded-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-display font-bold text-slate-800">Stock Adjustment</h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="space-y-4 py-4">
              {adjustFormError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{adjustFormError}</div>}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Product</label>
                <select 
                  value={selectedProductId} 
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl"
                >
                  <option value="">Select Product</option>
                  {dashboardData?.stocks?.map((s: WarehouseStock) => (
                    <option key={s.id} value={s.productId}>{s.productName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Warehouse</label>
                <select 
                  value={selectedWarehouseId} 
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl"
                >
                  <option value="">Select Warehouse</option>
                  {warehouses?.map((w: Warehouse) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Type</label>
                  <select 
                    value={adjustType} 
                    onChange={(e) => setAdjustType(e.target.value as any)}
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="ADDITION">Addition</option>
                    <option value="REMOVAL">Removal</option>
                    <option value="ADJUSTMENT">Modify Total Amount</option>
                    <option value="DAMAGE">Damage</option>
                    <option value="EXPIRY">Expiry</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {adjustType === 'ADJUSTMENT' ? 'New Total Quantity' : 'Quantity'}
                  </label>
                  <input 
                    type="number" 
                    value={adjustQty} 
                    onChange={(e) => setAdjustQty(Number(e.target.value))}
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Reason</label>
                <input 
                  type="text" 
                  value={adjustReason} 
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="E.g., Physical Audit Correct"
                  className="w-full px-4 py-2 border rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="btn-secondary px-4 py-2">Cancel</button>
                <button type="submit" disabled={adjustMutation.isPending} className="btn-primary px-4 py-2">
                  {adjustMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Product Modal */}
      {isAddProductModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto sm:p-6">
          <div className="w-full max-w-2xl bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 my-8 shrink-0">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-display font-bold text-slate-800">
                {editingProductId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsAddProductModalOpen(false)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleProductSubmit} className="space-y-4 py-4">
              {productFormError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{productFormError}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Product Name *</label>
                  <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full px-4 py-2 border rounded-xl" placeholder="E.g., Rice 5kg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Barcode *</label>
                  <input type="text" value={productBarcode} onChange={(e) => setProductBarcode(e.target.value)} className="w-full px-4 py-2 border rounded-xl" placeholder="E.g., 89012345" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Description</label>
                  <input type="text" value={productDesc} onChange={(e) => setProductDesc(e.target.value)} className="w-full px-4 py-2 border rounded-xl" placeholder="Optional details" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Cost Price *</label>
                  <input type="number" step="0.01" value={productCost} onChange={(e) => setProductCost(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Selling Price *</label>
                  <input type="number" step="0.01" value={productSelling} onChange={(e) => setProductSelling(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">MRP *</label>
                  <input type="number" step="0.01" value={productMrp} onChange={(e) => setProductMrp(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Reorder Level</label>
                  <input type="number" value={productReorder} onChange={(e) => setProductReorder(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Unit *</label>
                  <select value={productUnit} onChange={(e) => setProductUnit(e.target.value)} className="w-full px-4 py-2 border rounded-xl bg-white">
                    <option value="">Select Unit</option>
                    {units?.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Category *</label>
                  <select value={productSubCat} onChange={(e) => setProductSubCat(e.target.value)} className="w-full px-4 py-2 border rounded-xl bg-white">
                    <option value="">Select Category</option>
                    {categories?.map((c: any) => (
                      <optgroup key={c.id} label={c.name}>
                        {c.subCategories?.map((sub: any) => (
                          <option key={sub.id} value={sub.id}>{sub.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Brand *</label>
                  <select value={productBrand} onChange={(e) => setProductBrand(e.target.value)} className="w-full px-4 py-2 border rounded-xl bg-white">
                    <option value="">Select Brand</option>
                    {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">GST Category *</label>
                  <select value={productGst} onChange={(e) => setProductGst(e.target.value)} className="w-full px-4 py-2 border rounded-xl bg-white">
                    <option value="">Select GST Rate</option>
                    {gstCategories?.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.rate}%)</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Supplier *</label>
                  <select value={productSupplier} onChange={(e) => setProductSupplier(e.target.value)} className="w-full px-4 py-2 border rounded-xl bg-white">
                    <option value="">Select Supplier</option>
                    {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsAddProductModalOpen(false)} className="btn-secondary px-4 py-2">Cancel</button>
                <button type="submit" disabled={addProductMutation.isPending || editProductMutation.isPending} className="btn-primary px-4 py-2">
                  {addProductMutation.isPending || editProductMutation.isPending 
                    ? (editingProductId ? 'Saving...' : 'Adding...') 
                    : (editingProductId ? 'Save Changes' : 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Inventory;
