import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  RotateCcw, 
  Search, 
  Loader2, 
  X, 
  AlertCircle,
  FileText,
  Plus
} from 'lucide-react';
import api from '../services/api.ts';

interface InvoiceItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  product: {
    name: string;
    barcode: string;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  createdAt: string;
  customerId: string | null;
  customer?: { name: string } | null;
  items: InvoiceItem[];
}

export const CreditNotes: React.FC = () => {
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<Record<string, { quantity: number; reason: string }>>({});
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CREDIT_NOTE'>('CREDIT_NOTE');
  const [remarks, setRemarks] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Query: Search Invoice ---
  const { data: invoiceData, isLoading: isInvoiceLoading, refetch } = useQuery({
    queryKey: ['invoice-lookup', invoiceSearch],
    queryFn: async () => {
      if (!invoiceSearch) return null;
      const res = await api.get('/pos/invoices', { params: { search: invoiceSearch, limit: 5 } });
      const invoices = res.data.data.invoices as Invoice[];
      return invoices.length > 0 ? invoices[0] : null;
    },
    enabled: false
  });

  // --- Mutation: Create Return / Credit Note ---
  const createReturnMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/returns', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSuccessMsg(`Credit Note ${data.returnNumber} created successfully! Amount: ₹${data.refundAmount.toFixed(2)}`);
      resetForm();
    },
    onError: (err) => {
      const msg = (err as any).response?.data?.error?.message || 'Failed to create credit note.';
      setErrorMsg(msg);
    }
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    if (!invoiceSearch) return;
    refetch();
  };

  const resetForm = () => {
    setSelectedInvoiceId(null);
    setReturnItems({});
    setRemarks('');
  };

  const handleItemQtyChange = (productId: string, maxQty: number, val: number) => {
    const qty = Math.min(maxQty, Math.max(0, val));
    setReturnItems(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        quantity: qty
      }
    }));
  };

  const handleItemReasonChange = (productId: string, reason: string) => {
    setReturnItems(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        reason
      }
    }));
  };

  const handleSubmitReturn = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!invoiceData) return;

    // Filter out items with 0 return quantity
    const itemsToReturn = Object.entries(returnItems)
      .map(([productId, data]) => {
        const invItem = invoiceData.items.find(i => i.productId === productId);
        return {
          productId,
          quantity: data.quantity,
          reason: data.reason || 'Customer Return',
          unitRefundAmount: invItem ? invItem.unitPrice : 0
        };
      })
      .filter(item => item.quantity > 0);

    if (itemsToReturn.length === 0) {
      setErrorMsg('Please select at least one item to return with quantity > 0.');
      return;
    }

    // Default warehouse WH-MAIN
    // In real system, we fetch warehouses or use the default one
    createReturnMutation.mutate({
      invoiceId: invoiceData.id,
      warehouseId: '802df9de-c793-455b-801f-0e12b7754d5b', // Main Warehouse ID (seeded)
      refundMethod,
      remarks: remarks || 'Credit Note Return',
      items: itemsToReturn
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-6">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-800">Credit Notes</h2>
          <p className="text-slate-500 text-sm mt-0.5">Issue store credit notes or cash refunds against original sales invoices.</p>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-semibold">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-sm">
          {errorMsg}
        </div>
      )}

      {/* Search Invoice Box */}
      <div className="glass-card p-6">
        <h3 className="font-display font-bold text-slate-800 text-base mb-4">Search Sales Invoice</h3>
        <form onSubmit={handleSearchSubmit} className="flex gap-3 max-w-lg">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Enter Invoice Number (e.g. INV-20260630-0001)..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
            />
          </div>
          <button 
            type="submit" 
            disabled={isInvoiceLoading}
            className="btn-primary px-5 py-2.5 text-sm shrink-0"
          >
            {isInvoiceLoading ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
          </button>
        </form>
      </div>

      {/* Invoice Details & Return Form */}
      {invoiceData ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Invoice Items List */}
          <div className="lg:col-span-8 glass-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-display font-bold text-slate-800 text-base">Invoice Items</span>
              <span className="text-xs text-slate-500">Invoice: <strong className="text-slate-700">{invoiceData.invoiceNumber}</strong></span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-400 font-medium border-b border-slate-100 pb-2">
                    <th className="pb-3">Product Description</th>
                    <th className="pb-3 text-center">Purchased Qty</th>
                    <th className="pb-3 text-right">Price</th>
                    <th className="pb-3 text-center w-24">Return Qty</th>
                    <th className="pb-3">Return Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoiceData.items.map((item) => {
                    const returnData = returnItems[item.productId] || { quantity: 0, reason: '' };
                    return (
                      <tr key={item.id} className="text-slate-700">
                        <td className="py-3 font-medium text-slate-800">
                          {item.product.name}
                          <div className="text-xs text-slate-400 font-normal">{item.product.barcode}</div>
                        </td>
                        <td className="py-3 text-center">{item.quantity}</td>
                        <td className="py-3 text-right">₹{item.unitPrice.toFixed(2)}</td>
                        <td className="py-3 text-center">
                          <input 
                            type="number" 
                            min="0" 
                            max={item.quantity}
                            value={returnData.quantity}
                            onChange={(e) => handleItemQtyChange(item.productId, item.quantity, Number(e.target.value))}
                            className="w-16 px-2 py-1 border rounded-lg text-center"
                          />
                        </td>
                        <td className="py-3">
                          <input 
                            type="text" 
                            placeholder="Reason..."
                            value={returnData.reason}
                            onChange={(e) => handleItemReasonChange(item.productId, e.target.value)}
                            className="w-full px-2 py-1 border rounded-lg text-xs focus:outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Refund Summary & Submit */}
          <div className="lg:col-span-4 glass-card p-6 space-y-4 h-fit">
            <h3 className="font-display font-bold text-slate-800 text-base border-b border-slate-100 pb-3">Credit Summary</h3>
            
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold text-slate-800">{invoiceData.customer?.name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between">
                <span>Refund Method:</span>
                <select 
                  value={refundMethod} 
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="px-2 py-1 border rounded-lg text-xs"
                >
                  <option value="CREDIT_NOTE">Credit Note</option>
                  <option value="CASH">Cash Refund</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t">
              <label className="text-xs font-semibold text-slate-500 block mb-1">Remarks</label>
              <textarea 
                value={remarks} 
                onChange={(e) => setRemarks(e.target.value)}
                rows={3} 
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none"
                placeholder="Enter credit note remarks..."
              />
            </div>

            <button 
              onClick={handleSubmitReturn}
              disabled={createReturnMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-brand-blue-600 to-brand-blue-500 hover:from-brand-blue-700 hover:to-brand-blue-600 text-white font-bold rounded-xl shadow-lg shadow-brand-blue-500/10 hover:shadow-brand-blue-500/20 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              {createReturnMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : 'Create Credit Note'}
            </button>
          </div>
        </div>
      ) : (
        invoiceSearch && !isInvoiceLoading && (
          <div className="text-center py-12 text-slate-500 bg-white border rounded-2xl shadow-sm">
            No invoice found with number "{invoiceSearch}".
          </div>
        )
      )}
    </div>
  );
};

export default CreditNotes;
