import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api.js';
import { useAuth } from '../App.tsx';
import { 
  Truck, 
  FileText, 
  Plus, 
  Eye, 
  Check, 
  X, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp, 
  Building, 
  CreditCard, 
  Star,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface BankDetails {
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  gstIn: string | null;
  pan: string | null;
  address: string | null;
  creditPeriod: number;
  creditLimit: number;
  category: string;
  bankDetails: BankDetails;
  defaultCurrency: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';
  notes: string | null;
  performanceRating: number;
  isActive: boolean;
}

interface PurchaseOrderItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;

    barcode: string;
  };
  quantity: number;
  unitCost: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalCost: number;
  receivedQuantity: number;
  remarks: string | null;
}

interface POTimelineEvent {
  id: string;
  status: string;
  description: string;
  createdAt: string;
  user: {
    username: string;
  };
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier: {
    name: string;
  };
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED';
  version: number;
  totalAmount: number;
  approvalComments: string | null;
  warehouseId: string;
  warehouse: {
    name: string;
  };
  expectedDeliveryDate: string;
  createdById: string;
  creator: {
    username: string;
  };
  approvedById: string | null;
  approver: {
    username: string;
  } | null;
  items: PurchaseOrderItem[];
  timeline: POTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

interface NewPOItem {
  productId: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  discountAmount: number;
  remarks?: string;
}

interface Product {
  id: string;
  name: string;

  costPrice: number;
  gstCategory?: {
    rate: number;
  };
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface ProcurementMetrics {
  metrics: {
    pendingPOs: number;
    approvedPOs: number;
    sentPOs: number;
    delayedPOs: number;
    totalPOs: number;
    todayPurchases: number;
  };
  topSuppliers: Supplier[];
}

interface POsResponse {
  data: PurchaseOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const Procurement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'suppliers'>('dashboard');
  
  // Search & Filter state for POs
  const [poSearch, setPoSearch] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState('');
  const [poPage, setPoPage] = useState(1);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');

  // Fetch Procurement Dashboard Metrics
  const { data: metricsData, isLoading: isMetricsLoading } = useQuery<ProcurementMetrics>({
    queryKey: ['procurement-metrics'],
    queryFn: async () => {
      const res = await api.get('/procurement/metrics');
      return res.data.data;
    },
    refetchInterval: 30000, // Poll every 30s
  });

  // Fetch Purchase Orders
  const { data: posData, isLoading: isPosLoading } = useQuery<POsResponse>({
    queryKey: ['purchase-orders', poSearch, poStatusFilter, poPage],
    queryFn: async () => {
      const res = await api.get('/procurement/pos', {
        params: {
          page: poPage,
          limit: 8,
          search: poSearch || undefined,
          status: poStatusFilter || undefined,
        },
      });
      return res.data;
    },
  });

  // Fetch Suppliers (for PO creation dropdown and Supplier Profile list)
  const { data: suppliersData, isLoading: isSuppliersLoading } = useQuery<Supplier[]>({
    queryKey: ['procurement-suppliers'],
    queryFn: async () => {
      const res = await api.get('/master/suppliers', { params: { limit: 100 } });
      return res.data.data;
    },
  });

  // Fetch Products (for PO creation dropdown)
  const { data: productsData } = useQuery<Product[]>({
    queryKey: ['procurement-products'],
    queryFn: async () => {
      const res = await api.get('/master/products', { params: { limit: 100 } });
      return res.data.data;
    },
  });

  // Fetch Warehouses (for PO creation dropdown)
  const { data: warehousesData } = useQuery<Warehouse[]>({
    queryKey: ['procurement-warehouses'],
    queryFn: async () => {
      const res = await api.get('/inventory/warehouses');
      return res.data.data;
    },
  });

  // Mutation to Create PO
  const [newPOItems, setNewPOItems] = useState<NewPOItem[]>([{ productId: '', quantity: 1, unitCost: 0, taxRate: 18.0, discountAmount: 0 }]);
  const [newPOSupplier, setNewPOSupplier] = useState('');
  const [newPOWarehouse, setNewPOWarehouse] = useState('');
  const [newPODeliveryDate, setNewPODeliveryDate] = useState('');

  const createPOMutation = useMutation({
    mutationFn: async (poData: { supplierId: string; warehouseId: string; expectedDeliveryDate: string; items: NewPOItem[]; }) => {
      const res = await api.post('/procurement/pos', poData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-metrics'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
  });

  const resetCreateForm = () => {
    setNewPOSupplier('');
    setNewPOWarehouse('');
    setNewPODeliveryDate('');
    setNewPOItems([{ productId: '', quantity: 1, unitCost: 0, taxRate: 18.0, discountAmount: 0 }]);
  };

  // Mutation to Update PO Status (Approval/Sent)
  const updatePOStatusMutation = useMutation({
    mutationFn: async ({ poId, status, comments }: { poId: string; status: string; comments?: string }) => {
      const res = await api.patch(`/procurement/pos/${poId}/status`, { status, approvalComments: comments });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-metrics'] });
      if (selectedPO?.id === data.data.id) {
        refetchPODetails(data.data.id);
      }
    },
  });

  const refetchPODetails = async (poId: string) => {
    const res = await api.get(`/procurement/pos/${poId}`);
    setSelectedPO(res.data.data);
  };

  // Mutation to Update Supplier Profile
  const updateSupplierMutation = useMutation({
    mutationFn: async ({ supplierId, data }: { supplierId: string; data: Partial<Supplier> }) => {
      const res = await api.patch(`/procurement/suppliers/${supplierId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-metrics'] });
      setIsSupplierModalOpen(false);
      setSelectedSupplier(null);
    },
  });

  // Calculate PO values dynamically
  const calculatePOTotals = () => {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;
    
    newPOItems.forEach((item) => {
      const itemSub = (item.quantity || 0) * (item.unitCost || 0);
      const itemTax = itemSub * ((item.taxRate || 0) / 100);
      subtotal += itemSub;
      tax += itemTax;
      discount += item.discountAmount || 0;
    });

    return {
      subtotal,
      tax,
      discount,
      grandTotal: subtotal + tax - discount,
    };
  };

  const handleCreatePOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPOSupplier || !newPOWarehouse || !newPODeliveryDate) return;

    createPOMutation.mutate({
      supplierId: newPOSupplier,
      warehouseId: newPOWarehouse,
      expectedDeliveryDate: new Date(newPODeliveryDate).toISOString(),
      items: newPOItems.filter(item => item.productId),
    });
  };

  const handleAddPOItem = () => {
    setNewPOItems([...newPOItems, { productId: '', quantity: 1, unitCost: 0, taxRate: 18.0, discountAmount: 0 }]);
  };

  const handleRemovePOItem = (index: number) => {
    if (newPOItems.length === 1) return;
    setNewPOItems(newPOItems.filter((_, i) => i !== index));
  };

  const handlePOItemChange = (index: number, field: keyof NewPOItem, value: string | number) => {
    const updated = [...newPOItems];
    
    if (field === 'productId') {
      updated[index].productId = value as string;
      if (productsData) {
        const selectedProd = productsData.find((p) => p.id === value);
        if (selectedProd) {
          updated[index].unitCost = selectedProd.costPrice || 0;
          updated[index].taxRate = selectedProd.gstCategory?.rate || 0.0;
        }
      }
    } else if (field === 'quantity') {
      updated[index].quantity = value as number;
    } else if (field === 'unitCost') {
      updated[index].unitCost = value as number;
    } else if (field === 'taxRate') {
      updated[index].taxRate = value as number;
    } else if (field === 'discountAmount') {
      updated[index].discountAmount = value as number;
    }

    setNewPOItems(updated);
  };

  const handlePOAction = (poId: string, status: string) => {
    updatePOStatusMutation.mutate({
      poId,
      status,
      comments: status === 'APPROVED' ? approvalComments : undefined,
    });
    setApprovalComments('');
  };

  // Supplier form state
  const [supplierCategory, setSupplierCategory] = useState('');
  const [supplierCreditLimit, setSupplierCreditLimit] = useState(0);
  const [supplierCreditPeriod, setSupplierCreditPeriod] = useState(0);
  const [supplierBankName, setSupplierBankName] = useState('');
  const [supplierAccNo, setSupplierAccNo] = useState('');
  const [supplierIfsc, setSupplierIfsc] = useState('');
  const [supplierCurrency, setSupplierCurrency] = useState('INR');
  const [supplierStatus, setSupplierStatus] = useState<'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'>('ACTIVE');
  const [supplierNotes, setSupplierNotes] = useState('');

  const openSupplierEdit = (sup: Supplier) => {
    setSelectedSupplier(sup);
    setSupplierCategory(sup.category || 'General');
    setSupplierCreditLimit(sup.creditLimit || 0);
    setSupplierCreditPeriod(sup.creditPeriod || 0);
    setSupplierBankName(sup.bankDetails?.bankName || '');
    setSupplierAccNo(sup.bankDetails?.accountNumber || '');
    setSupplierIfsc(sup.bankDetails?.ifscCode || '');
    setSupplierCurrency(sup.defaultCurrency || 'INR');
    setSupplierStatus(sup.status || 'ACTIVE');
    setSupplierNotes(sup.notes || '');
    setIsSupplierModalOpen(true);
  };

  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    updateSupplierMutation.mutate({
      supplierId: selectedSupplier.id,
      data: {
        category: supplierCategory,
        creditLimit: Number(supplierCreditLimit),
        creditPeriod: Number(supplierCreditPeriod),
        defaultCurrency: supplierCurrency,
        status: supplierStatus,
        notes: supplierNotes,
        bankDetails: {
          bankName: supplierBankName,
          accountNumber: supplierAccNo,
          ifscCode: supplierIfsc,
        },
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'PENDING_APPROVAL': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'APPROVED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SENT': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'PARTIAL': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'COMPLETE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CANCELLED': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-emerald-600" />
            Procurement Terminal
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage purchase orders, suppliers, and procurement approvals</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              resetCreateForm();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Purchase Order
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'dashboard'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview Dashboard
        </button>
        <button
          onClick={() => setActiveTab('pos')}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'pos'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'suppliers'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Supplier Profiles
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Dashboard KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approvals</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                  {isMetricsLoading ? '...' : metricsData?.metrics?.pendingPOs}
                </h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved POs</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                  {isMetricsLoading ? '...' : metricsData?.metrics?.approvedPOs}
                </h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delayed Deliveries</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                  {isMetricsLoading ? '...' : metricsData?.metrics?.delayedPOs}
                </h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Purchases</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                  {isMetricsLoading ? '...' : `₹${(metricsData?.metrics?.todayPurchases || 0).toFixed(2)}`}
                </h3>
              </div>
            </div>
          </div>

          {/* Supplier Rankings & Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Top Performing Suppliers
              </h3>
              
              <div className="divide-y divide-slate-100">
                {isMetricsLoading ? (
                  <p className="text-slate-500 py-4 text-center">Loading supplier rankings...</p>
                ) : metricsData?.topSuppliers?.length === 0 ? (
                  <p className="text-slate-500 py-4 text-center">No supplier performance data available.</p>
                ) : (
                  metricsData?.topSuppliers?.map((sup: Supplier, idx: number) => (
                    <div key={sup.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-emerald-50 text-emerald-700 font-bold rounded-lg flex items-center justify-center text-sm">
                          #{idx + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 text-sm">{sup.name}</h4>
                          <p className="text-slate-500 text-xs">{sup.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="text-sm font-bold text-slate-700">{(sup.performanceRating || 5.0).toFixed(1)}</span>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          sup.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {sup.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Procurement Status</h3>
                <p className="text-slate-500 text-xs mb-4">Real-time purchase order breakdown</p>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Pending Approval</span>
                    <span className="font-semibold text-slate-800">{metricsData?.metrics?.pendingPOs}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500" 
                      style={{ width: `${((metricsData?.metrics?.pendingPOs || 0) / (metricsData?.metrics?.totalPOs || 1)) * 100}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-sm pt-2">
                    <span className="text-slate-600">Approved & Sent</span>
                    <span className="font-semibold text-slate-800">
                      {(metricsData?.metrics?.approvedPOs || 0) + (metricsData?.metrics?.sentPOs || 0)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${(((metricsData?.metrics?.approvedPOs || 0) + (metricsData?.metrics?.sentPOs || 0)) / (metricsData?.metrics?.totalPOs || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 mt-6">
                <button
                  onClick={() => setActiveTab('pos')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                >
                  View All Purchase Orders
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Orders Tab */}
      {activeTab === 'pos' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Search & Filter bar */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search PO number or supplier name..."
                value={poSearch}
                onChange={(e) => {
                  setPoSearch(e.target.value);
                  setPoPage(1);
                }}
                className="pl-9 pr-4 py-2 w-full border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none transition-all"
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <select
                  value={poStatusFilter}
                  onChange={(e) => {
                    setPoStatusFilter(e.target.value);
                    setPoPage(1);
                  }}
                  className="pl-9 pr-8 py-2 w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none appearance-none transition-all"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="SENT">Sent</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="COMPLETE">Complete</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                  <th className="py-4 px-6">PO Number</th>
                  <th className="py-4 px-6">Supplier</th>
                  <th className="py-4 px-6">Warehouse</th>
                  <th className="py-4 px-6">Expected Delivery</th>
                  <th className="py-4 px-6 text-right">Total Amount</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {isPosLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">Loading purchase orders...</td>
                  </tr>
                ) : posData?.data?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">No purchase orders found.</td>
                  </tr>
                ) : (
                  posData?.data?.map((po: PurchaseOrder) => (
                    <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-900">{po.poNumber}</td>
                      <td className="py-4 px-6">{po.supplier.name}</td>
                      <td className="py-4 px-6">{po.warehouse.name}</td>
                      <td className="py-4 px-6 flex items-center gap-1.5 text-slate-600">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-800">₹{po.totalAmount.toFixed(2)}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(po.status)}`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={async () => {
                            await refetchPODetails(po.id);
                            setIsDetailsModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {posData?.pagination && (
            <div className="p-5 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
              <p>Showing Page {poPage} of {posData.pagination.totalPages || 1}</p>
              <div className="flex gap-2">
                <button
                  disabled={poPage === 1}
                  onClick={() => setPoPage(p => p - 1)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={poPage === posData.pagination.totalPages}
                  onClick={() => setPoPage(p => p + 1)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Supplier Profiles Tab */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isSuppliersLoading ? (
            <p className="text-slate-500 col-span-full text-center py-8">Loading suppliers...</p>
          ) : suppliersData?.length === 0 ? (
            <p className="text-slate-500 col-span-full text-center py-8">No suppliers found.</p>
          ) : (
            suppliersData?.map((sup: Supplier) => (
              <div key={sup.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">{sup.name}</h3>
                      <p className="text-slate-500 text-xs">{sup.category || 'General'}</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-sm font-bold text-slate-700">{(sup.performanceRating || 5.0).toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 mb-6">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-slate-400" />
                      <span>Period: {sup.creditPeriod || 0} Days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-slate-400" />
                      <span>Limit: ${sup.creditLimit ? sup.creditLimit.toFixed(2) : '0.00'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-slate-400" />
                      <span>Bank: {sup.bankDetails?.bankName || 'Not Set'}</span>
                    </div>
                  </div>
                </div>

                {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                  <button
                    onClick={() => openSupplierEdit(sup)}
                    className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Edit Profile Details
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* CREATE PO MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck className="h-5 w-5 text-emerald-600" />
                Create Purchase Order
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePOSubmit} className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Supplier</label>
                  <select
                    required
                    value={newPOSupplier}
                    onChange={(e) => setNewPOSupplier(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  >
                    <option value="">Select Supplier</option>
                    {suppliersData?.map((s: Supplier) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Warehouse Destination</label>
                  <select
                    required
                    value={newPOWarehouse}
                    onChange={(e) => setNewPOWarehouse(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  >
                    <option value="">Select Warehouse</option>
                    {warehousesData?.map((w: Warehouse) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Expected Delivery Date</label>
                  <input
                    type="date"
                    required
                    value={newPODeliveryDate}
                    onChange={(e) => setNewPODeliveryDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-800">Order Items</h4>
                  <button
                    type="button"
                    onClick={handleAddPOItem}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item Row
                  </button>
                </div>

                <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
                  {newPOItems.map((item, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-3 items-end bg-slate-50 p-4 rounded-xl relative border border-slate-100">
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Product</label>
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => handlePOItemChange(idx, 'productId', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                        >
                          <option value="">Select Product</option>
                          {productsData?.map((p: Product) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full md:w-24">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handlePOItemChange(idx, 'quantity', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                        />
                      </div>

                      <div className="w-full md:w-28">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit Cost</label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => handlePOItemChange(idx, 'unitCost', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                        />
                      </div>

                      <div className="w-full md:w-20">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">GST %</label>
                        <input
                          type="number"
                          required
                          step="0.1"
                          value={item.taxRate}
                          onChange={(e) => handlePOItemChange(idx, 'taxRate', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                        />
                      </div>

                      <div className="w-full md:w-28">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Discount</label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          value={item.discountAmount}
                          onChange={(e) => handlePOItemChange(idx, 'discountAmount', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                        />
                      </div>

                      {newPOItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePOItem(idx)}
                          className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg hover:text-rose-700 transition-all cursor-pointer self-center"
                          title="Remove item"
                        >
                          <X className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary and Submit */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-t border-slate-100 pt-6 gap-4">
                <div className="text-sm space-y-1">
                  <p className="text-slate-500">Subtotal: <span className="font-semibold text-slate-800">₹{calculatePOTotals().subtotal.toFixed(2)}</span></p>
                  <p className="text-slate-500">GST Tax: <span className="font-semibold text-slate-800">₹{calculatePOTotals().tax.toFixed(2)}</span></p>
                  <p className="text-slate-500">Discount: <span className="font-semibold text-slate-800">-${calculatePOTotals().discount.toFixed(2)}</span></p>
                  <p className="text-base font-bold text-slate-900">PO Total Amount: <span className="text-emerald-600">₹{calculatePOTotals().grandTotal.toFixed(2)}</span></p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 md:flex-none px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createPOMutation.isPending}
                    className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    {createPOMutation.isPending ? 'Submitting...' : 'Submit Purchase Order'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO DETAILS / APPROVAL MODAL */}
      {isDetailsModalOpen && selectedPO && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedPO.poNumber}</h3>
                <p className="text-slate-500 text-xs mt-0.5">Supplier: {selectedPO.supplier.name}</p>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Creator</span>
                  <span className="font-semibold text-slate-800">{selectedPO.creator.username}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Approver</span>
                  <span className="font-semibold text-slate-800">{selectedPO.approver?.username || 'None'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Expected Delivery</span>
                  <span className="font-semibold text-slate-800">{new Date(selectedPO.expectedDeliveryDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Total Amount</span>
                  <span className="font-bold text-emerald-600">₹{selectedPO.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Order Items</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4 text-center">Qty Ordered</th>
                        <th className="py-3 px-4 text-center">Qty Received</th>
                        <th className="py-3 px-4 text-right">Unit Cost</th>
                        <th className="py-3 px-4 text-right">GST %</th>
                        <th className="py-3 px-4 text-right">Discount</th>
                        <th className="py-3 px-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedPO.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.product.name}</td>
                          <td className="py-3 px-4 text-center">{item.quantity}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-semibold ${item.receivedQuantity > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {item.receivedQuantity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">₹{item.unitCost.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right">{item.taxRate}%</td>
                          <td className="py-3 px-4 text-right">-${item.discountAmount.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-semibold">₹{item.totalCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Workflow Timeline</h4>
                <div className="space-y-4">
                  {selectedPO.timeline.map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-xs">
                          <Check className="h-3 w-3" />
                        </div>
                        <div className="w-0.5 bg-slate-200 flex-1 my-1 last:hidden" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-slate-800">{event.description}</p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {new Date(event.createdAt).toLocaleString()} by {event.user.username}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approval Action Form (for Managers/Admins when PENDING_APPROVAL) */}
              {selectedPO.status === 'PENDING_APPROVAL' && (user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    Pending Manager Approval Decision
                  </h4>
                  
                  <textarea
                    placeholder="Enter approval or rejection comments (optional)..."
                    value={approvalComments}
                    onChange={(e) => setApprovalComments(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                    rows={2}
                  />

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handlePOAction(selectedPO.id, 'CANCELLED')}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      Reject / Cancel PO
                    </button>
                    <button
                      onClick={() => handlePOAction(selectedPO.id, 'APPROVED')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      Approve Purchase Order
                    </button>
                  </div>
                </div>
              )}

              {/* Sent to Supplier Action (when APPROVED) */}
              {selectedPO.status === 'APPROVED' && (user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                <div className="border-t border-slate-100 pt-6 flex justify-end">
                  <button
                    onClick={() => handlePOAction(selectedPO.id, 'SENT')}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Truck className="h-4 w-4" />
                    Mark as Sent to Supplier
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER EDIT MODAL */}
      {isSupplierModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Supplier Profile</h3>
                <p className="text-slate-500 text-xs mt-0.5">{selectedSupplier.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsSupplierModalOpen(false);
                  setSelectedSupplier(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSupplierSubmit} className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                  <input
                    type="text"
                    value={supplierCategory}
                    onChange={(e) => setSupplierCategory(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Default Currency</label>
                  <input
                    type="text"
                    value={supplierCurrency}
                    onChange={(e) => setSupplierCurrency(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Credit Period (Days)</label>
                  <input
                    type="number"
                    value={supplierCreditPeriod}
                    onChange={(e) => setSupplierCreditPeriod(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Credit Limit (₹)</label>
                  <input
                    type="number"
                    value={supplierCreditLimit}
                    onChange={(e) => setSupplierCreditLimit(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h4 className="text-sm font-bold text-slate-800 mb-3">Bank Transfer Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Bank Name</label>
                    <input
                      type="text"
                      value={supplierBankName}
                      onChange={(e) => setSupplierBankName(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Account Number</label>
                    <input
                      type="text"
                      value={supplierAccNo}
                      onChange={(e) => setSupplierAccNo(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">IFSC / SWIFT Code</label>
                    <input
                      type="text"
                      value={supplierIfsc}
                      onChange={(e) => setSupplierIfsc(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Supplier Status</label>
                  <select
                    value={supplierStatus}
                    onChange={(e) => setSupplierStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED')}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive / On Hold</option>
                    <option value="BLACKLISTED">Blacklisted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Internal Notes / Remarks</label>
                <textarea
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsSupplierModalOpen(false);
                    setSelectedSupplier(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateSupplierMutation.isPending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
                >
                  {updateSupplierMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Procurement;
