import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api.js';
import { useAuth } from '../App.tsx';
import { 
  Building, 
  DollarSign, 
  Calendar, 
  Clock, 
  ArrowUpRight, 
  Plus, 
  FileText, 
  Search, 
  X, 
  ArrowDownLeft,
  AlertTriangle
} from 'lucide-react';

interface AgingBuckets {
  bucket0to30: number;
  bucket31to60: number;
  bucket61to90: number;
  bucketOver90: number;
}

interface SupplierAP {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  creditPeriod: number;
  creditLimit: number;
  outstandingBalance: number;
  aging: AgingBuckets;
}

interface SupplierLedgerEntry {
  id: string;
  type: 'INVOICE' | 'PAYMENT' | 'DEBIT_NOTE' | 'ADVANCE';
  amount: number;
  previousBalance: number;
  newBalance: number;
  notes: string | null;
  createdAt: string;
  invoice: {
    invoiceNumber: string;
  } | null;
}

interface SupplierPayment {
  id: string;
  paymentNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceNumber: string | null;
  notes: string | null;
  createdBy: {
    username: string;
  };
}

interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  status: string;
}

export const AccountsPayable: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierAP | null>(null);

  // Payment Form states
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [linkedInvoiceId, setLinkedInvoiceId] = useState('');

  // Fetch AP Supplier list (with aging)
  const { data: apSuppliers, isLoading: isApLoading } = useQuery<SupplierAP[]>({
    queryKey: ['ap-suppliers'],
    queryFn: async () => {
      const res = await api.get('/ap/aging');
      return res.data.data;
    },
  });

  // Fetch Supplier Ledger (un-paginated for statement view, or simple listing)
  const { data: ledgerEntries, isLoading: isLedgerLoading } = useQuery<SupplierLedgerEntry[]>({
    queryKey: ['supplier-ledger', selectedSupplier?.id],
    queryFn: async () => {
      if (!selectedSupplier) return [];
      const res = await api.get(`/ap/suppliers/${selectedSupplier.id}/ledger`);
      return res.data.data;
    },
    enabled: !!selectedSupplier,
  });

  // Fetch Supplier Payments list
  const { data: supplierPayments } = useQuery<SupplierPayment[]>({
    queryKey: ['supplier-payments', selectedSupplier?.id],
    queryFn: async () => {
      if (!selectedSupplier) return [];
      const res = await api.get(`/ap/suppliers/${selectedSupplier.id}/payments`);
      return res.data.data;
    },
    enabled: !!selectedSupplier,
  });

  // Fetch Supplier Invoices (only posted, to link payment to)
  const { data: supplierInvoices } = useQuery<SupplierInvoice[]>({
    queryKey: ['supplier-posted-invoices', selectedSupplier?.id],
    queryFn: async () => {
      if (!selectedSupplier) return [];
      const res = await api.get('/supplier-invoices', { params: { supplierId: selectedSupplier.id, status: 'POSTED', limit: 100 } });
      return res.data.data;
    },
    enabled: !!selectedSupplier && isPaymentModalOpen,
  });

  // Record Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { supplierId: string; amount: number; paymentMethod: string; referenceNumber?: string; notes?: string; invoiceId?: string }) => {
      const res = await api.post('/ap/payments', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-suppliers'] });
      if (selectedSupplier) {
        queryClient.invalidateQueries({ queryKey: ['supplier-ledger', selectedSupplier.id] });
        queryClient.invalidateQueries({ queryKey: ['supplier-payments', selectedSupplier.id] });
      }
      setIsPaymentModalOpen(false);
      resetPaymentForm();
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      alert(err.response?.data?.error?.message || 'Failed to record payment');
    },
  });

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setPaymentMethod('BANK_TRANSFER');
    setReferenceNumber('');
    setPaymentNotes('');
    setLinkedInvoiceId('');
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !paymentAmount) return;

    recordPaymentMutation.mutate({
      supplierId: selectedSupplier.id,
      amount: Number(paymentAmount),
      paymentMethod,
      referenceNumber: referenceNumber || undefined,
      notes: paymentNotes || undefined,
      invoiceId: linkedInvoiceId || undefined,
    });
  };

  // Compute AP Totals
  const totalAP = apSuppliers?.reduce((acc, s) => acc + s.outstandingBalance, 0) || 0;
  const total0to30 = apSuppliers?.reduce((acc, s) => acc + s.aging.bucket0to30, 0) || 0;
  const total31to60 = apSuppliers?.reduce((acc, s) => acc + s.aging.bucket31to60, 0) || 0;
  const total61to90 = apSuppliers?.reduce((acc, s) => acc + s.aging.bucket61to90, 0) || 0;
  const totalOver90 = apSuppliers?.reduce((acc, s) => acc + s.aging.bucketOver90, 0) || 0;

  // Filter suppliers by search
  const filteredSuppliers = apSuppliers?.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLedgerTypeStyle = (type: string) => {
    switch (type) {
      case 'INVOICE': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'PAYMENT': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'ADVANCE': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'DEBIT_NOTE': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building className="h-6 w-6 text-brand-blue-600" />
            Accounts Payable & Supplier Ledger
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage supplier liabilities, age aging invoices, and record payment vouchers</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Payables</span>
            <DollarSign className="h-4 w-4 text-brand-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mt-2">₹{totalAP.toFixed(2)}</h3>
          <p className="text-[10px] text-slate-400 mt-1">Current supplier liability</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">0 - 30 Days</span>
            <Clock className="h-4 w-4 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mt-2">₹{total0to30.toFixed(2)}</h3>
          <p className="text-[10px] text-emerald-600 font-medium mt-1">
            {totalAP > 0 ? ((total0to30 / totalAP) * 100).toFixed(1) : 0}% of total
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">31 - 60 Days</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mt-2">₹{total31to60.toFixed(2)}</h3>
          <p className="text-[10px] text-blue-600 font-medium mt-1">
            {totalAP > 0 ? ((total31to60 / totalAP) * 100).toFixed(1) : 0}% of total
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-amber-500">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">61 - 90 Days</span>
            <Calendar className="h-4 w-4 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mt-2">₹{total61to90.toFixed(2)}</h3>
          <p className="text-[10px] text-amber-600 font-medium mt-1">
            {totalAP > 0 ? ((total61to90 / totalAP) * 100).toFixed(1) : 0}% of total
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-rose-500">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase">90+ Days Overdue</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mt-2">₹{totalOver90.toFixed(2)}</h3>
          <p className="text-[10px] text-rose-600 font-medium mt-1">
            {totalAP > 0 ? ((totalOver90 / totalAP) * 100).toFixed(1) : 0}% of total
          </p>
        </div>
      </div>

      {/* AP Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search supplier accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-slate-200 focus:border-brand-blue-500 rounded-xl text-sm outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                <th className="py-4 px-6">Supplier</th>
                <th className="py-4 px-6 text-right">Outstanding AP</th>
                <th className="py-4 px-6 text-right">0 - 30 Days</th>
                <th className="py-4 px-6 text-right">31 - 60 Days</th>
                <th className="py-4 px-6 text-right">61 - 90 Days</th>
                <th className="py-4 px-6 text-right">90+ Days</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isApLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading Accounts Payable aging...</td>
                </tr>
              ) : filteredSuppliers?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No supplier accounts found.</td>
                </tr>
              ) : (
                filteredSuppliers?.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-semibold text-slate-900">{sup.name}</p>
                        <p className="text-xs text-slate-400">Terms: {sup.creditPeriod} Days</p>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-slate-950">₹{sup.outstandingBalance.toFixed(2)}</td>
                    <td className="py-4 px-6 text-right font-medium text-slate-600">₹{sup.aging.bucket0to30.toFixed(2)}</td>
                    <td className="py-4 px-6 text-right font-medium text-slate-600">₹{sup.aging.bucket31to60.toFixed(2)}</td>
                    <td className="py-4 px-6 text-right font-medium text-slate-600">₹{sup.aging.bucket61to90.toFixed(2)}</td>
                    <td className={`py-4 px-6 text-right font-bold ${sup.aging.bucketOver90 > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      ${sup.aging.bucketOver90.toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex justify-center gap-2">
                        {user?.role === 'ADMIN' || user?.role === 'MANAGER' ? (
                          <button
                            onClick={() => {
                              setSelectedSupplier(sup);
                              setIsPaymentModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100 transition-all cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Pay Supplier
                          </button>
                        ) : null}
                        <button
                          onClick={() => {
                            setSelectedSupplier(sup);
                            setIsStatementModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-brand-blue-50 hover:bg-brand-blue-100 text-brand-blue-700 text-xs font-bold rounded-lg border border-brand-blue-100 transition-all cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Statement
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Supplier Payment</h3>
                <p className="text-slate-500 text-xs mt-0.5">Supplier: {selectedSupplier.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  resetPaymentForm();
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Outstanding Liability:</span>
                <span className="font-bold text-slate-900">₹{selectedSupplier.outstandingBalance.toFixed(2)}</span>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1 uppercase">Payment Amount (₹)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  max={selectedSupplier.outstandingBalance}
                  placeholder="Enter amount to pay..."
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE')}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none font-semibold"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash Drawer Payout</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Reference Number</label>
                  <input
                    type="text"
                    placeholder="TXN ID, Cheque #..."
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Link to Invoice (Optional)</label>
                <select
                  value={linkedInvoiceId}
                  onChange={(e) => setLinkedInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-brand-blue-500 rounded-lg text-sm outline-none"
                >
                  <option value="">No Link (On Account Payment)</option>
                  {supplierInvoices?.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.invoiceNumber} (${inv.grandTotal.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Payment Notes / Description</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 focus:border-brand-blue-500 rounded-xl text-sm outline-none"
                  rows={2}
                  placeholder="Record bank account details, cheque date, etc..."
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    resetPaymentForm();
                  }}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending || !paymentAmount}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? 'Posting...' : 'Post Payment Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATEMENT / LEDGER MODAL */}
      {isStatementModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Supplier Statement of Account</h3>
                <p className="text-slate-500 text-xs mt-0.5">{selectedSupplier.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsStatementModalOpen(false);
                  setSelectedSupplier(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto text-xs">
              {/* Account Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Supplier Contact</span>
                  <span className="font-semibold text-slate-800">{selectedSupplier.contactName || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Phone / Email</span>
                  <span className="font-semibold text-slate-800">{selectedSupplier.phone || selectedSupplier.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Credit Period</span>
                  <span className="font-semibold text-slate-800">{selectedSupplier.creditPeriod} Days</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Current AP Balance</span>
                  <span className="font-bold text-slate-900">₹{selectedSupplier.outstandingBalance.toFixed(2)}</span>
                </div>
              </div>

              {/* Tabs inside Statement */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800">Chronological Ledger history</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Posting Date</th>
                        <th className="py-3 px-4">Entry Type</th>
                        <th className="py-3 px-4">Invoice Ref</th>
                        <th className="py-3 px-4 text-right">Debit (₹)</th>
                        <th className="py-3 px-4 text-right">Credit (₹)</th>
                        <th className="py-3 px-4 text-right">AP Balance (₹)</th>
                        <th className="py-3 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {isLedgerLoading ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">Loading ledger...</td>
                        </tr>
                      ) : ledgerEntries?.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">No ledger transactions found.</td>
                        </tr>
                      ) : (
                        ledgerEntries?.map((entry) => {
                          const isDebit = entry.type === 'PAYMENT' || entry.type === 'DEBIT_NOTE' || entry.type === 'ADVANCE';
                          const isCredit = entry.type === 'INVOICE';
                          
                          return (
                            <tr key={entry.id} className="hover:bg-slate-50/20">
                              <td className="py-3 px-4 text-slate-500">{new Date(entry.createdAt).toLocaleString()}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${getLedgerTypeStyle(entry.type)}`}>
                                  {entry.type}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-800">{entry.invoice?.invoiceNumber || 'N/A'}</td>
                              <td className="py-3 px-4 text-right font-bold text-slate-950">
                                {isDebit ? (
                                  <span className="text-emerald-600 flex items-center justify-end gap-0.5">
                                    <ArrowDownLeft className="h-3 w-3" />
                                    {entry.amount.toFixed(2)}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-950">
                                {isCredit ? (
                                  <span className="text-rose-600 flex items-center justify-end gap-0.5">
                                    <ArrowUpRight className="h-3 w-3" />
                                    {entry.amount.toFixed(2)}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-950">₹{entry.newBalance.toFixed(2)}</td>
                              <td className="py-3 px-4 text-slate-500 text-[10px] max-w-xs truncate" title={entry.notes || ''}>
                                {entry.notes}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment history list */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800">Payment Vouchers History</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Voucher No</th>
                        <th className="py-3 px-4">Payment Date</th>
                        <th className="py-3 px-4 text-right">Paid Amount</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4">Reference No</th>
                        <th className="py-3 px-4">Created By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {supplierPayments?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">No payment vouchers found.</td>
                        </tr>
                      ) : (
                        supplierPayments?.map((p) => (
                          <tr key={p.id}>
                            <td className="py-3 px-4 font-semibold text-slate-900">{p.paymentNumber}</td>
                            <td className="py-3 px-4 text-slate-500">{new Date(p.paymentDate).toLocaleDateString()}</td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900">₹{p.amount.toFixed(2)}</td>
                            <td className="py-3 px-4 text-slate-500 text-[10px] font-semibold">{p.paymentMethod}</td>
                            <td className="py-3 px-4 font-medium text-slate-800">{p.referenceNumber || 'N/A'}</td>
                            <td className="py-3 px-4 text-slate-500">{p.createdBy.username}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AccountsPayable;
