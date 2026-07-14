import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api.js';
import { useAuth } from '../App.tsx';
import { 
  RotateCcw, 
  Plus, 
  Eye, 
  Check, 
  X, 
  Search, 
  Loader2
} from 'lucide-react';

interface Warehouse {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;

}

interface CustomerReturnItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  reason: 'DAMAGED' | 'DEFECTIVE' | 'WRONG_ITEM' | 'CHANGE_OF_MIND';
  action: 'RETURN_TO_STOCK' | 'WRITE_OFF' | 'RETURN_TO_SUPPLIER';
  unitRefundAmount: number;
  remarks: string | null;
}

interface CustomerReturn {
  id: string;
  returnNumber: string;
  invoiceId: string;
  invoice: {
    invoiceNumber: string;
  };
  customerId: string | null;
  customer: {
    name: string;
    phone: string;
  } | null;
  warehouseId: string;
  warehouse: Warehouse;
  status: 'PENDING_INSPECTION' | 'COMPLETED' | 'REJECTED';
  refundMethod: 'CASH' | 'CREDIT_NOTE' | 'ORIGINAL_PAYMENT';
  refundAmount: number;
  createdById: string;
  createdBy: {
    username: string;
  };
  processedById: string | null;
  processedBy: {
    username: string;
  } | null;
  remarks: string | null;
  items: CustomerReturnItem[];
  createdAt: string;
}

interface InvoiceItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  costPrice: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  customerId: string | null;
  customer: {
    name: string;
  } | null;
  items: InvoiceItem[];
}

interface ReturnItemInput {
  productId: string;
  name: string;

  quantity: number;
  maxQuantity: number;
  reason: 'DAMAGED' | 'DEFECTIVE' | 'WRONG_ITEM' | 'CHANGE_OF_MIND';
  unitRefundAmount: number;
}

interface ProcessItemInput {
  itemId: string;
  action: 'RETURN_TO_STOCK' | 'WRITE_OFF' | 'RETURN_TO_SUPPLIER';
}

export const ReturnsRMA: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'queue' | 'logs'>('queue');
  
  // Search & Filters
  const [returnSearch, setReturnSearch] = useState('');
  const [returnPage, setReturnPage] = useState(1);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<CustomerReturn | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);

  // Wizard states
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [matchedInvoice, setMatchedInvoice] = useState<Invoice | null>(null);
  const [isFetchingInvoice, setIsFetchingInvoice] = useState(false);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CREDIT_NOTE' | 'ORIGINAL_PAYMENT'>('CASH');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItemInput[]>([]);

  // Inspection states
  const [inspectItemActions, setInspectItemActions] = useState<ProcessItemInput[]>([]);
  const [processRemarks, setProcessRemarks] = useState('');

  // Fetch Returns Queue & Logs
  const { data: returnsData, isLoading: isReturnsLoading } = useQuery<{ data: CustomerReturn[]; pagination: { total: number; page: number; limit: number; totalPages: number; } }>({
    queryKey: ['customer-returns', returnSearch, activeTab, returnPage],
    queryFn: async () => {
      const statusFilter = activeTab === 'queue' ? 'PENDING_INSPECTION' : 'COMPLETED,REJECTED';
      const res = await api.get('/returns', {
        params: {
          page: returnPage,
          limit: 8,
          search: returnSearch || undefined,
          status: statusFilter,
        },
      });
      return res.data;
    },
  });

  // Fetch Warehouses
  const { data: warehousesData } = useQuery<Warehouse[]>({
    queryKey: ['rma-warehouses'],
    queryFn: async () => {
      const res = await api.get('/inventory/warehouses');
      return res.data.data;
    },
  });

  // Fetch Invoice Details in Wizard
  const handleFetchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceSearchQuery) return;

    setIsFetchingInvoice(true);
    setMatchedInvoice(null);
    setReturnItems([]);
    
    try {
      // Find invoice by number
      const res = await api.get('/pos/invoices', { params: { search: invoiceSearchQuery, limit: 1 } });
      const invoices = res.data.data;
      if (invoices.length === 0) {
        alert('Invoice not found');
        return;
      }
      
      // Get detailed invoice
      const detailedRes = await api.get(`/pos/invoices/${invoices[0].id}`);
      const inv: Invoice = detailedRes.data.data;
      setMatchedInvoice(inv);
    } catch (err) {
      alert('Failed to fetch invoice details');
    } finally {
      setIsFetchingInvoice(false);
    }
  };

  // Toggle item selection in return wizard
  const handleToggleInvoiceItem = (item: InvoiceItem, isChecked: boolean) => {
    if (isChecked) {
      setReturnItems([
        ...returnItems,
        {
          productId: item.productId,
          name: item.product.name,

          quantity: 1,
          maxQuantity: item.quantity,
          reason: 'CHANGE_OF_MIND',
          unitRefundAmount: item.unitPrice,
        },
      ]);
    } else {
      setReturnItems(returnItems.filter(i => i.productId !== item.productId));
    }
  };

  const handleReturnItemChange = (idx: number, field: keyof ReturnItemInput, val: string | number) => {
    const updated = [...returnItems];
    if (field === 'quantity') {
      const max = updated[idx].maxQuantity;
      updated[idx].quantity = Math.min(max, Math.max(1, Number(val)));
    } else if (field === 'reason') {
      updated[idx].reason = val as 'DAMAGED' | 'DEFECTIVE' | 'WRONG_ITEM' | 'CHANGE_OF_MIND';
    } else if (field === 'unitRefundAmount') {
      updated[idx].unitRefundAmount = Math.max(0, Number(val));
    }
    setReturnItems(updated);
  };

  // Mutation to Create RMA
  const createReturnMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; warehouseId: string; refundMethod: string; remarks?: string; items: { productId: string; quantity: number; reason: string; unitRefundAmount: number; }[] }) => {
      const res = await api.post('/returns', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-returns'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
  });

  const resetCreateForm = () => {
    setInvoiceSearchQuery('');
    setMatchedInvoice(null);
    setDestinationWarehouseId('');
    setRefundMethod('CASH');
    setReturnRemarks('');
    setReturnItems([]);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedInvoice || !destinationWarehouseId || returnItems.length === 0) return;

    createReturnMutation.mutate({
      invoiceId: matchedInvoice.id,
      warehouseId: destinationWarehouseId,
      refundMethod,
      remarks: returnRemarks,
      items: returnItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        reason: item.reason,
        unitRefundAmount: item.unitRefundAmount,
      })),
    });
  };

  // Open Process Modal
  const openProcessModal = async (ret: CustomerReturn) => {
    setSelectedReturn(ret);
    // Initialize item actions
    const inputs: ProcessItemInput[] = ret.items.map(item => ({
      itemId: item.id,
      action: 'RETURN_TO_STOCK', // Default action: Return to stock
    }));
    setInspectItemActions(inputs);
    setProcessRemarks(ret.remarks || '');
    setIsProcessModalOpen(true);
  };

  const handleItemActionChange = (idx: number, action: 'RETURN_TO_STOCK' | 'WRITE_OFF' | 'RETURN_TO_SUPPLIER') => {
    const updated = [...inspectItemActions];
    updated[idx].action = action;
    setInspectItemActions(updated);
  };

  // Mutation to Process RMA
  const processReturnMutation = useMutation({
    mutationFn: async (data: { id: string; status: 'COMPLETED' | 'REJECTED'; remarks?: string; items: ProcessItemInput[] }) => {
      const res = await api.post(`/returns/${data.id}/process`, {
        status: data.status,
        remarks: data.remarks,
        items: data.items,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-returns'] });
      setIsProcessModalOpen(false);
      setSelectedReturn(null);
    },
  });

  const handleProcessSubmit = (status: 'COMPLETED' | 'REJECTED') => {
    if (!selectedReturn) return;

    processReturnMutation.mutate({
      id: selectedReturn.id,
      status,
      remarks: processRemarks,
      items: inspectItemActions,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_INSPECTION': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REJECTED': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRefundMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return 'Cash Refund';
      case 'CREDIT_NOTE': return 'Credit Note (Store Credit)';
      case 'ORIGINAL_PAYMENT': return 'Original Payment Method';
      default: return method;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-emerald-600" />
            Customer Returns & RMA
          </h1>
          <p className="text-slate-500 text-sm mt-1">Process invoice returns, inspect merchandise, and issue store credits/refunds</p>
        </div>

        <button
          onClick={() => {
            resetCreateForm();
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create Return Request
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('queue');
            setReturnPage(1);
          }}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'queue'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Active RMA Queue
        </button>
        <button
          onClick={() => {
            setActiveTab('logs');
            setReturnPage(1);
          }}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'logs'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Completed Logs
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
              placeholder="Search return RMA or invoice number..."
              value={returnSearch}
              onChange={(e) => {
                setReturnSearch(e.target.value);
                setReturnPage(1);
              }}
              className="pl-9 pr-4 py-2 w-full border border-slate-200 focus:border-emerald-500 rounded-xl text-sm outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                <th className="py-4 px-6">RMA Number</th>
                <th className="py-4 px-6">Invoice</th>
                <th className="py-4 px-6">Customer</th>
                <th className="py-4 px-6 text-right">Refund Amount</th>
                <th className="py-4 px-6">Refund Method</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isReturnsLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading returns...</td>
                </tr>
              ) : returnsData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No returns found.</td>
                </tr>
              ) : (
                returnsData?.data?.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">{r.returnNumber}</td>
                    <td className="py-4 px-6 text-slate-600 font-medium">{r.invoice.invoiceNumber}</td>
                    <td className="py-4 px-6">
                      {r.customer ? (
                        <div>
                          <p className="font-semibold text-slate-800">{r.customer.name}</p>
                          <p className="text-xs text-slate-400">{r.customer.phone}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">Walk-in Customer</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-slate-900">₹{r.refundAmount.toFixed(2)}</td>
                    <td className="py-4 px-6 text-slate-500 text-xs font-semibold">{getRefundMethodLabel(r.refundMethod)}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex justify-center gap-2">
                        {r.status === 'PENDING_INSPECTION' && (user?.role === 'ADMIN' || user?.role === 'MANAGER') ? (
                          <button
                            onClick={() => openProcessModal(r)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100 transition-all cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Inspect & Refund
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const res = await api.get(`/returns/${r.id}`);
                              setSelectedReturn(res.data.data);
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
        {returnsData?.pagination && (
          <div className="p-5 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
            <p>Showing Page {returnPage} of {returnsData.pagination.totalPages || 1}</p>
            <div className="flex gap-2">
              <button
                disabled={returnPage === 1}
                onClick={() => setReturnPage(p => p - 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={returnPage === returnsData.pagination.totalPages}
                onClick={() => setReturnPage(p => p + 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE RETURN MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-emerald-600" />
                New Customer Return Request (RMA)
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Invoice Lookup */}
              <form onSubmit={handleFetchInvoice} className="flex gap-2 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Original Invoice Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Invoice Number (e.g. INV-20260630-0001)..."
                    value={invoiceSearchQuery}
                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                    className="px-4 py-2 w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isFetchingInvoice}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg cursor-pointer h-10.5 flex items-center gap-1.5"
                >
                  {isFetchingInvoice && <Loader2 className="h-4 w-4 animate-spin" />}
                  Fetch Items
                </button>
              </form>

              {matchedInvoice && (
                <form onSubmit={handleCreateSubmit} className="space-y-6">
                  {/* Invoice details card */}
                  <div className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-xl text-xs grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-700">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Customer</span>
                      <span className="font-semibold text-slate-800">{matchedInvoice.customer?.name || 'Walk-in Customer'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Invoice Total</span>
                      <span className="font-semibold text-slate-800">₹{matchedInvoice.grandTotal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Destination Warehouse</span>
                      <select
                        required
                        value={destinationWarehouseId}
                        onChange={(e) => setDestinationWarehouseId(e.target.value)}
                        className="w-full mt-1 px-2 py-1 bg-white border border-slate-200 rounded-md outline-none"
                      >
                        <option value="">Select...</option>
                        {warehousesData?.map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Refund Option</span>
                      <select
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value as 'CASH' | 'CREDIT_NOTE' | 'ORIGINAL_PAYMENT')}
                        className="w-full mt-1 px-2 py-1 bg-white border border-slate-200 rounded-md outline-none"
                      >
                        <option value="CASH">Cash Refund</option>
                        {matchedInvoice.customerId && (
                          <option value="CREDIT_NOTE">Store Credit Note</option>
                        )}
                        <option value="ORIGINAL_PAYMENT">Original Payment Method</option>
                      </select>
                    </div>
                  </div>

                  {/* Invoice Items Selection */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-800">Select Items to Return</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                            <th className="py-3 px-4 text-center w-12">Select</th>
                            <th className="py-3 px-4">Product Name</th>
                            <th className="py-3 px-4 text-center w-20">Purchased Qty</th>
                            <th className="py-3 px-4 text-center w-24">Return Qty</th>
                            <th className="py-3 px-4 w-32">Return Reason</th>
                            <th className="py-3 px-4 text-right w-28">Refund Unit Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {matchedInvoice.items.map((item) => {
                            const isChecked = returnItems.some(i => i.productId === item.productId);
                            const returnItemIdx = returnItems.findIndex(i => i.productId === item.productId);
                            
                            return (
                              <tr key={item.id} className={isChecked ? 'bg-emerald-50/10' : ''}>
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => handleToggleInvoiceItem(item, e.target.checked)}
                                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 rounded border-slate-300"
                                  />
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-900">{item.product.name}</td>
                                <td className="py-3 px-4 text-center font-bold text-slate-500">{item.quantity}</td>
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.quantity}
                                    disabled={!isChecked}
                                    value={isChecked ? returnItems[returnItemIdx].quantity : 0}
                                    onChange={(e) => handleReturnItemChange(returnItemIdx, 'quantity', e.target.value)}
                                    className="w-16 px-1.5 py-0.5 text-center border border-slate-200 rounded-md disabled:bg-slate-50"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <select
                                    disabled={!isChecked}
                                    value={isChecked ? returnItems[returnItemIdx].reason : 'CHANGE_OF_MIND'}
                                    onChange={(e) => handleReturnItemChange(returnItemIdx, 'reason', e.target.value)}
                                    className="w-full px-1.5 py-0.5 bg-white border border-slate-200 rounded-md disabled:bg-slate-50"
                                  >
                                    <option value="CHANGE_OF_MIND">Change of Mind</option>
                                    <option value="DEFECTIVE">Defective Item</option>
                                    <option value="DAMAGED">Damaged Package</option>
                                    <option value="WRONG_ITEM">Wrong Item Sent</option>
                                  </select>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    disabled={!isChecked}
                                    value={isChecked ? returnItems[returnItemIdx].unitRefundAmount : 0.00}
                                    onChange={(e) => handleReturnItemChange(returnItemIdx, 'unitRefundAmount', e.target.value)}
                                    className="w-20 px-1.5 py-0.5 text-right border border-slate-200 rounded-md disabled:bg-slate-50"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Remarks / Return Description</label>
                    <textarea
                      value={returnRemarks}
                      onChange={(e) => setReturnRemarks(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                      rows={2}
                      placeholder="Note specific details about defective parts, customer comments, etc..."
                    />
                  </div>

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
                      disabled={createReturnMutation.isPending || returnItems.length === 0}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {createReturnMutation.isPending ? 'Submitting...' : 'Submit Return Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INSPECT & PROCESS MODAL */}
      {isProcessModalOpen && selectedReturn && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">RMA Inspection & Settlement</h3>
                <p className="text-slate-500 text-xs mt-0.5">{selectedReturn.returnNumber} - Original Invoice: {selectedReturn.invoice.invoiceNumber}</p>
              </div>
              <button
                onClick={() => {
                  setIsProcessModalOpen(false);
                  setSelectedReturn(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Return Location</span>
                  <span className="font-semibold text-slate-800">{selectedReturn.warehouse.name}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Refund Method</span>
                  <span className="font-semibold text-slate-800">{getRefundMethodLabel(selectedReturn.refundMethod)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Refund Amount</span>
                  <span className="font-bold text-slate-900">₹{selectedReturn.refundAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Created By</span>
                  <span className="font-semibold text-slate-800">{selectedReturn.createdBy.username}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Inspection Checklist</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>

                        <th className="py-3 px-4 text-center">Returned Qty</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4">Inventory Routing Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedReturn.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/20">
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.product.name}</td>

                          <td className="py-3 px-4 text-center font-bold text-slate-800">{item.quantity}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 border rounded-full">
                              {item.reason}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={inspectItemActions[idx]?.action || 'RETURN_TO_STOCK'}
                              onChange={(e) => handleItemActionChange(idx, e.target.value as 'RETURN_TO_STOCK' | 'WRITE_OFF' | 'RETURN_TO_SUPPLIER')}
                              className="px-2 py-1 bg-white border border-slate-200 rounded-md focus:border-emerald-500 outline-none font-semibold"
                            >
                              <option value="RETURN_TO_STOCK">Passed (Return to Stock)</option>
                              <option value="WRITE_OFF">Failed (Scrap / Write-off)</option>
                              <option value="RETURN_TO_SUPPLIER">Quarantine (Return to Supplier)</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Inspection Notes / Comments</label>
                <textarea
                  value={processRemarks}
                  onChange={(e) => setProcessRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  rows={2}
                  placeholder="Record packaging conditions, serial numbers inspected, etc..."
                />
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => handleProcessSubmit('REJECTED')}
                  disabled={processReturnMutation.isPending}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold rounded-xl transition-all cursor-pointer border border-rose-100"
                >
                  Reject Return Request
                </button>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProcessModalOpen(false);
                      setSelectedReturn(null);
                    }}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProcessSubmit('COMPLETED')}
                    disabled={processReturnMutation.isPending}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    {processReturnMutation.isPending ? 'Processing...' : 'Approve & Release Refund'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RETURN DETAILS VIEW MODAL */}
      {isDetailsModalOpen && selectedReturn && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedReturn.returnNumber}</h3>
                <p className="text-slate-500 text-xs mt-0.5">Original Invoice: {selectedReturn.invoice.invoiceNumber}</p>
              </div>
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedReturn(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-xs text-slate-700">
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Warehouse Destination</span>
                  <span className="font-semibold text-slate-800">{selectedReturn.warehouse.name}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Refund Method</span>
                  <span className="font-semibold text-slate-800">{getRefundMethodLabel(selectedReturn.refundMethod)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Refund Amount</span>
                  <span className="font-bold text-slate-900">₹{selectedReturn.refundAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(selectedReturn.status)}`}>
                    {selectedReturn.status}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Returned Items Registry</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>

                        <th className="py-3 px-4 text-center">Returned Qty</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4">Routing Action</th>
                        <th className="py-3 px-4 text-right">Refund Unit Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedReturn.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.product.name}</td>

                          <td className="py-3 px-4 text-center font-bold text-slate-800">{item.quantity}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 border rounded-full">
                              {item.reason}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-600">{item.action}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">₹{item.unitRefundAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedReturn.remarks && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Remarks</h4>
                  <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedReturn.remarks}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ReturnsRMA;
