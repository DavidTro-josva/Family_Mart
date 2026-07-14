import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api.js';
import { useAuth } from '../App.tsx';
import { 
  FileText, 
  Plus, 
  Eye, 
  Check, 
  X, 
  Search, 
  AlertTriangle
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  totalAmount: number;
  items: {
    id: string;
    productId: string;
    quantityRequested: number;
    unitPrice: number;
  }[];
}

interface GoodsReceipt {
  id: string;
  grnNumber: string;
  items: {
    id: string;
    productId: string;
    quantityReceived: number;
  }[];
}

interface Product {
  id: string;
  name: string;

}

interface SupplierInvoiceItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  total: number;
}

interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  supplierId: string;
  supplier: Supplier;
  purchaseOrderId: string | null;
  purchaseOrder: PurchaseOrder | null;
  goodsReceiptId: string | null;
  goodsReceipt: GoodsReceipt | null;
  subTotal: number;
  taxAmount: number;
  grandTotal: number;
  status: 'PENDING_MATCH' | 'MATCHED' | 'VARIANCE_REJECTED' | 'POSTED';
  matchStatus: 'PERFECT_MATCH' | 'QTY_VARIANCE' | 'PRICE_VARIANCE' | 'TAX_VARIANCE' | 'MULTI_VARIANCE';
  receivedDate: string;
  remarks: string | null;
  items: SupplierInvoiceItem[];
  createdAt: string;
}

interface InvoiceItemInput {
  productId: string;
  name: string;

  quantity: number;
  unitPrice: number;
  taxAmount: number;
  total: number;
}

export const SupplierInvoices: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState<'pending' | 'posted'>('pending');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);

  // Wizard states
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedGrnId, setSelectedGrnId] = useState('');
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [invoiceDateInput, setInvoiceDateInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [invoiceRemarks, setInvoiceRemarks] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemInput[]>([]);

  // Match override remarks
  const [overrideRemarks, setOverrideRemarks] = useState('');

  // Fetch Invoices
  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery<{ data: SupplierInvoice[]; pagination: { total: number; page: number; limit: number; totalPages: number; } }>({
    queryKey: ['supplier-invoices', searchQuery, activeTab, page],
    queryFn: async () => {
      const statusFilter = activeTab === 'pending' ? 'PENDING_MATCH,VARIANCE_REJECTED' : 'MATCHED,POSTED';
      const res = await api.get('/supplier-invoices', {
        params: {
          page,
          limit: 8,
          search: searchQuery || undefined,
          status: statusFilter,
        },
      });
      return res.data;
    },
  });

  // Fetch Suppliers
  const { data: suppliersData } = useQuery<Supplier[]>({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await api.get('/master/suppliers');
      return res.data.data;
    },
  });

  // Fetch POs for selected supplier
  const { data: posData } = useQuery<PurchaseOrder[]>({
    queryKey: ['supplier-pos', selectedSupplierId],
    queryFn: async () => {
      if (!selectedSupplierId) return [];
      const res = await api.get('/procurement/pos', { params: { supplierId: selectedSupplierId, limit: 100 } });
      return res.data.data;
    },
    enabled: !!selectedSupplierId,
  });

  // Fetch GRNs for selected PO
  const { data: grnsData } = useQuery<GoodsReceipt[]>({
    queryKey: ['po-grns', selectedPoId],
    queryFn: async () => {
      if (!selectedPoId) return [];
      const res = await api.get('/receiving/grns', { params: { purchaseOrderId: selectedPoId, limit: 100 } });
      return res.data.data;
    },
    enabled: !!selectedPoId,
  });

  // Fetch products for manual addition
  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-list'],
    queryFn: async () => {
      const res = await api.get('/master/products', { params: { limit: 100 } });
      return res.data;
    },
  });

  // Handle PO selection: auto-populate items from PO and GRN
  const handlePoChange = async (poId: string) => {
    setSelectedPoId(poId);
    setSelectedGrnId('');
    if (!poId) {
      setInvoiceItems([]);
      return;
    }

    const selectedPo = posData?.find(p => p.id === poId);
    if (!selectedPo) return;

    // Fetch PO details with product info
    try {
      const res = await api.get(`/procurement/pos/${poId}`);
      const poDetails = res.data.data;
      
      const items: InvoiceItemInput[] = poDetails.items.map((item: { productId: string; product: { name: string; }; quantityRequested: number; unitPrice: number; }) => ({
        productId: item.productId,
        name: item.product.name,

        quantity: item.quantityRequested,
        unitPrice: item.unitPrice,
        taxAmount: (item.quantityRequested * item.unitPrice) * 0.18, // Estimated 18% GST
        total: (item.quantityRequested * item.unitPrice) * 1.18,
      }));
      setInvoiceItems(items);
    } catch (err) {
      console.error('Failed to load PO details');
    }
  };

  // Handle GRN selection: update quantities based on actual received
  const handleGrnChange = async (grnId: string) => {
    setSelectedGrnId(grnId);
    if (!grnId) return;

    try {
      const res = await api.get(`/receiving/grns/${grnId}`);
      const grnDetails = res.data.data;

      const updated = invoiceItems.map(item => {
        const grnItem = grnDetails.items.find((i: { productId: string; quantityReceived: number; }) => i.productId === item.productId);
        if (grnItem) {
          const qty = grnItem.quantityReceived;
          const sub = qty * item.unitPrice;
          return {
            ...item,
            quantity: qty,
            taxAmount: sub * 0.18,
            total: sub * 1.18,
          };
        }
        return item;
      });
      setInvoiceItems(updated);
    } catch (err) {
      console.error('Failed to load GRN details');
    }
  };

  const handleInvoiceItemChange = (idx: number, field: keyof InvoiceItemInput, val: number) => {
    const updated = [...invoiceItems];
    if (field === 'quantity') {
      updated[idx].quantity = Math.max(1, Math.floor(val));
    } else if (field === 'unitPrice') {
      updated[idx].unitPrice = Math.max(0, val);
    } else if (field === 'taxAmount') {
      updated[idx].taxAmount = Math.max(0, val);
    }
    
    // Recompute total
    const sub = updated[idx].quantity * updated[idx].unitPrice;
    updated[idx].total = sub + updated[idx].taxAmount;
    setInvoiceItems(updated);
  };

  const handleAddManualItem = (productId: string) => {
    const product = productsData?.data.find(p => p.id === productId);
    if (!product) return;

    if (invoiceItems.some(i => i.productId === productId)) {
      alert('Product already in invoice');
      return;
    }

    setInvoiceItems([
      ...invoiceItems,
      {
        productId: product.id,
        name: product.name,

        quantity: 1,
        unitPrice: 10.0,
        taxAmount: 1.8,
        total: 11.8,
      },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== idx));
  };

  // Calculate Subtotals
  const calculatedSubTotal = invoiceItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const calculatedTaxAmount = invoiceItems.reduce((acc, item) => acc + item.taxAmount, 0);
  const calculatedGrandTotal = calculatedSubTotal + calculatedTaxAmount;

  // Mutation to Create Invoice
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: { 
      invoiceNumber: string; 
      invoiceDate: string; 
      dueDate: string; 
      supplierId: string; 
      purchaseOrderId: string | null; 
      goodsReceiptId: string | null; 
      subTotal: number; 
      taxAmount: number; 
      grandTotal: number; 
      remarks?: string; 
      items: InvoiceItemInput[]; 
    }) => {
      const res = await api.post('/supplier-invoices', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
  });

  const resetCreateForm = () => {
    setSelectedSupplierId('');
    setSelectedPoId('');
    setSelectedGrnId('');
    setInvoiceNumberInput('');
    setInvoiceDateInput('');
    setDueDateInput('');
    setInvoiceRemarks('');
    setInvoiceItems([]);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !invoiceNumberInput || invoiceItems.length === 0) return;

    createInvoiceMutation.mutate({
      invoiceNumber: invoiceNumberInput,
      invoiceDate: new Date(invoiceDateInput).toISOString(),
      dueDate: new Date(dueDateInput).toISOString(),
      supplierId: selectedSupplierId,
      purchaseOrderId: selectedPoId || null,
      goodsReceiptId: selectedGrnId || null,
      subTotal: calculatedSubTotal,
      taxAmount: calculatedTaxAmount,
      grandTotal: calculatedGrandTotal,
      remarks: invoiceRemarks,
      items: invoiceItems,
    });
  };

  // Mutation to Post/Approve Invoice
  const postInvoiceMutation = useMutation({
    mutationFn: async (data: { id: string; status: 'POSTED' | 'VARIANCE_REJECTED'; remarks?: string }) => {
      const res = await api.post(`/supplier-invoices/${data.id}/post`, {
        status: data.status,
        remarks: data.remarks,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      setIsMatchModalOpen(false);
      setSelectedInvoice(null);
      setOverrideRemarks('');
    },
  });

  const handlePostSubmit = (status: 'POSTED' | 'VARIANCE_REJECTED') => {
    if (!selectedInvoice) return;
    postInvoiceMutation.mutate({
      id: selectedInvoice.id,
      status,
      remarks: overrideRemarks,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_MATCH': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'MATCHED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'POSTED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'VARIANCE_REJECTED': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case 'PERFECT_MATCH': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'QTY_VARIANCE':
      case 'PRICE_VARIANCE':
      case 'TAX_VARIANCE':
      case 'MULTI_VARIANCE':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-brand-blue-600" />
            Supplier Invoice & Three-Way Match
          </h1>
          <p className="text-slate-500 text-sm mt-1">Verify PO pricing, GRN quantities, and post matched invoices to Accounts Payable</p>
        </div>

        <button
          onClick={() => {
            resetCreateForm();
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue-600 hover:bg-brand-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Receive Supplier Invoice
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('pending');
            setPage(1);
          }}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'pending'
              ? 'border-brand-blue-600 text-brand-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Verification Queue
        </button>
        <button
          onClick={() => {
            setActiveTab('posted');
            setPage(1);
          }}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'posted'
              ? 'border-brand-blue-600 text-brand-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Posted / Archive
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice number or supplier..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-4 py-2 w-full border border-slate-200 focus:border-brand-blue-500 rounded-xl text-sm outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                <th className="py-4 px-6">Invoice Number</th>
                <th className="py-4 px-6">Supplier</th>
                <th className="py-4 px-6">References</th>
                <th className="py-4 px-6 text-right">Grand Total</th>
                <th className="py-4 px-6">Due Date</th>
                <th className="py-4 px-6">Match Verification</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isInvoicesLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading invoices...</td>
                </tr>
              ) : invoicesData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No invoices found in this queue.</td>
                </tr>
              ) : (
                invoicesData?.data?.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="py-4 px-6 font-medium text-slate-800">{inv.supplier.name}</td>
                    <td className="py-4 px-6 text-xs text-slate-500">
                      <div>PO: {inv.purchaseOrder?.poNumber || 'N/A'}</div>
                      <div>GRN: {inv.goodsReceipt?.grnNumber || 'N/A'}</div>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-slate-900">₹{inv.grandTotal.toFixed(2)}</td>
                    <td className="py-4 px-6 text-slate-500 text-xs">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getMatchStatusColor(inv.matchStatus)}`}>
                        {inv.matchStatus}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex justify-center gap-2">
                        {inv.status !== 'POSTED' && (user?.role === 'ADMIN' || user?.role === 'MANAGER') ? (
                          <button
                            onClick={async () => {
                              const res = await api.get(`/supplier-invoices/${inv.id}`);
                              setSelectedInvoice(res.data.data);
                              setIsMatchModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-brand-blue-50 hover:bg-brand-blue-100 text-brand-blue-700 text-xs font-bold rounded-lg border border-brand-blue-100 transition-all cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Match & Post
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const res = await api.get(`/supplier-invoices/${inv.id}`);
                              setSelectedInvoice(res.data.data);
                              setIsDetailsModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {invoicesData?.pagination && (
          <div className="p-5 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
            <p>Showing Page {page} of {invoicesData.pagination.totalPages || 1}</p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page === invoicesData.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RECEIVE INVOICE WIZARD MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-blue-600" />
                Receive Supplier Invoice
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto text-xs">
              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1 uppercase tracking-wider">Supplier</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value);
                      setSelectedPoId('');
                      setSelectedGrnId('');
                      setInvoiceItems([]);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none"
                  >
                    <option value="">Select Supplier...</option>
                    {suppliersData?.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1 uppercase tracking-wider">Purchase Order Reference (Optional)</label>
                  <select
                    value={selectedPoId}
                    onChange={(e) => handlePoChange(e.target.value)}
                    disabled={!selectedSupplierId}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none disabled:bg-slate-100"
                  >
                    <option value="">No PO Link</option>
                    {posData?.map((p) => (
                      <option key={p.id} value={p.id}>{p.poNumber} (${p.totalAmount.toFixed(2)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1 uppercase tracking-wider">Goods Receipt Reference (Optional)</label>
                  <select
                    value={selectedGrnId}
                    onChange={(e) => handleGrnChange(e.target.value)}
                    disabled={!selectedPoId}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none disabled:bg-slate-100"
                  >
                    <option value="">No GRN Link</option>
                    {grnsData?.map((g) => (
                      <option key={g.id} value={g.id}>{g.grnNumber}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Invoice Specifics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1 uppercase tracking-wider">Supplier Invoice Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Invoice Reference..."
                    value={invoiceNumberInput}
                    onChange={(e) => setInvoiceNumberInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={invoiceDateInput}
                    onChange={(e) => setInvoiceDateInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none"
                  />
                </div>
              </div>

              {/* Manual Product Addition (if no PO link) */}
              {!selectedPoId && (
                <div className="flex gap-2 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex-1">
                    <label className="block text-slate-500 font-semibold mb-1">Add Product Manually</label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddManualItem(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none"
                    >
                      <option value="">Select Product...</option>
                      {productsData?.data.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Invoice Line Items</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4 text-center w-24">Invoiced Qty</th>
                        <th className="py-3 px-4 text-right w-32">Unit Price (₹)</th>
                        <th className="py-3 px-4 text-right w-32">Tax Amount (₹)</th>
                        <th className="py-3 px-4 text-right w-32">Total (₹)</th>
                        <th className="py-3 px-4 text-center w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {invoiceItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 font-medium">No items added yet.</td>
                        </tr>
                      ) : (
                        invoiceItems.map((item, idx) => (
                          <tr key={item.productId} className="hover:bg-slate-50/20">
                            <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                            <td className="py-3 px-4 text-center">
                              <input
                                type="number"
                                required
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleInvoiceItemChange(idx, 'quantity', Number(e.target.value))}
                                className="w-16 px-1.5 py-0.5 text-center border border-slate-200 rounded-md"
                              />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <input
                                type="number"
                                required
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => handleInvoiceItemChange(idx, 'unitPrice', Number(e.target.value))}
                                className="w-24 px-1.5 py-0.5 text-right border border-slate-200 rounded-md"
                              />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <input
                                type="number"
                                required
                                step="0.01"
                                value={item.taxAmount}
                                onChange={(e) => handleInvoiceItemChange(idx, 'taxAmount', Number(e.target.value))}
                                className="w-24 px-1.5 py-0.5 text-right border border-slate-200 rounded-md"
                              />
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900">₹{item.total.toFixed(2)}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks & Totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-slate-500 font-semibold mb-2">Invoice Remarks / Internal Notes</label>
                  <textarea
                    value={invoiceRemarks}
                    onChange={(e) => setInvoiceRemarks(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500 rounded-xl text-sm outline-none"
                    rows={3}
                    placeholder="Enter any additional notes..."
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-medium">₹{calculatedSubTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Tax (GST)</span>
                    <span className="font-medium">₹{calculatedTaxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold text-base pt-2 border-t border-slate-200">
                    <span>Grand Total</span>
                    <span>₹{calculatedGrandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createInvoiceMutation.isPending || invoiceItems.length === 0}
                  className="px-5 py-2.5 bg-brand-blue-600 hover:bg-brand-blue-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {createInvoiceMutation.isPending ? 'Verifying...' : 'Submit & Match Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* THREE-WAY MATCH WORKSTATION MODAL */}
      {isMatchModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Three-Way Match Verification Workstation</h3>
                <p className="text-slate-500 text-xs mt-0.5">Invoice: {selectedInvoice.invoiceNumber} - Supplier: {selectedInvoice.supplier.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsMatchModalOpen(false);
                  setSelectedInvoice(null);
                  setOverrideRemarks('');
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-xs">
              {/* References Header */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Purchase Order</span>
                  <span className="font-semibold text-slate-800">{selectedInvoice.purchaseOrder?.poNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Goods Receipt</span>
                  <span className="font-semibold text-slate-800">{selectedInvoice.goodsReceipt?.grnNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Match Status</span>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getMatchStatusColor(selectedInvoice.matchStatus)}`}>
                    {selectedInvoice.matchStatus}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Invoice Total</span>
                  <span className="font-bold text-slate-900">₹{selectedInvoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Match Details Alert */}
              {selectedInvoice.matchStatus !== 'PERFECT_MATCH' ? (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Discrepancies Detected</p>
                    <p className="text-xs mt-1">This invoice contains price or quantity variances from the original Purchase Order/Goods Receipt. Manager override is required to post this invoice to Accounts Payable.</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex gap-3">
                  <Check className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Perfect Match Verified</p>
                    <p className="text-xs mt-1">Invoiced prices and quantities perfectly match the PO and GRN. This invoice is ready to be posted to Accounts Payable.</p>
                  </div>
                </div>
              )}

              {/* Comparison Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Match Verification Checklist</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4 text-center">PO Ordered Qty</th>
                        <th className="py-3 px-4 text-center">GRN Received Qty</th>
                        <th className="py-3 px-4 text-center">Invoiced Qty</th>
                        <th className="py-3 px-4 text-right">PO Ordered Price</th>
                        <th className="py-3 px-4 text-right">Invoiced Price</th>
                        <th className="py-3 px-4 text-center">Variance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedInvoice.items.map((item) => {
                        const poItem = selectedInvoice.purchaseOrder?.items.find(i => i.productId === item.productId);
                        const grnItem = selectedInvoice.goodsReceipt?.items.find(i => i.productId === item.productId);

                        const hasQtyVariance = grnItem && item.quantity > grnItem.quantityReceived;
                        const hasPriceVariance = poItem && Math.abs(item.unitPrice - poItem.unitPrice) > 0.01;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/20">
                            <td className="py-3 px-4 font-semibold text-slate-900">{item.product.name}</td>
                            <td className="py-3 px-4 text-center font-bold text-slate-500">{poItem?.quantityRequested || 'N/A'}</td>
                            <td className="py-3 px-4 text-center font-bold text-slate-500">{grnItem?.quantityReceived || 'N/A'}</td>
                            <td className={`py-3 px-4 text-center font-bold ${hasQtyVariance ? 'text-rose-600 bg-rose-50/50' : 'text-slate-800'}`}>
                              {item.quantity}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-500">₹{poItem ? poItem.unitPrice.toFixed(2) : 'N/A'}</td>
                            <td className={`py-3 px-4 text-right font-bold ${hasPriceVariance ? 'text-rose-600 bg-rose-50/50' : 'text-slate-800'}`}>
                              ${item.unitPrice.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {hasQtyVariance || hasPriceVariance ? (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-50 border border-rose-100 text-rose-700 rounded-full">
                                  Discrepancy
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full">
                                  Matched
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes from Match results */}
              {selectedInvoice.remarks && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Variance Audit Log</h4>
                  <pre className="text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono whitespace-pre-wrap">
                    {selectedInvoice.remarks}
                  </pre>
                </div>
              )}

              {/* Override comments */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Override Reason / AP Approval Notes</label>
                <textarea
                  value={overrideRemarks}
                  onChange={(e) => setOverrideRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500 rounded-xl text-sm outline-none"
                  rows={2}
                  placeholder="Record reasons for accepting price variances, billing adjustments, etc..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => handlePostSubmit('VARIANCE_REJECTED')}
                  disabled={postInvoiceMutation.isPending}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold rounded-xl transition-all cursor-pointer border border-rose-100"
                >
                  Reject Invoice
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMatchModalOpen(false);
                      setSelectedInvoice(null);
                      setOverrideRemarks('');
                    }}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePostSubmit('POSTED')}
                    disabled={postInvoiceMutation.isPending}
                    className="px-5 py-2.5 bg-brand-blue-600 hover:bg-brand-blue-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    {postInvoiceMutation.isPending ? 'Posting...' : 'Approve & Post to Accounts Payable'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED INVOICE VIEW MODAL */}
      {isDetailsModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Invoice Details: {selectedInvoice.invoiceNumber}</h3>
                <p className="text-slate-500 text-xs mt-0.5">Supplier: {selectedInvoice.supplier.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedInvoice(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-xs text-slate-700">
              {/* Details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">PO Reference</span>
                  <span className="font-semibold text-slate-800">{selectedInvoice.purchaseOrder?.poNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">GRN Reference</span>
                  <span className="font-semibold text-slate-800">{selectedInvoice.goodsReceipt?.grnNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(selectedInvoice.status)}`}>
                    {selectedInvoice.status}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Grand Total</span>
                  <span className="font-bold text-slate-900">₹{selectedInvoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Line Items</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>

                        <th className="py-3 px-4 text-center">Invoiced Qty</th>
                        <th className="py-3 px-4 text-right">Unit Price</th>
                        <th className="py-3 px-4 text-right">Tax Amount</th>
                        <th className="py-3 px-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.product.name}</td>

                          <td className="py-3 px-4 text-center font-bold text-slate-800">{item.quantity}</td>
                          <td className="py-3 px-4 text-right font-medium">₹{item.unitPrice.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right text-slate-500">₹{item.taxAmount.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">₹{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedInvoice.remarks && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Audit Notes & Variance Logs</h4>
                  <pre className="text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono whitespace-pre-wrap">
                    {selectedInvoice.remarks}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SupplierInvoices;
