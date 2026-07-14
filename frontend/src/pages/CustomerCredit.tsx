import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CreditCard, 
  Search, 
  History, 
  Coins, 
  Loader2, 
  X,
  AlertCircle
} from 'lucide-react';
import api from '../services/api.ts';

// --- Type Definitions ---
interface Customer {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  outstandingBalance: number;
}

interface LedgerEntry {
  id: string;
  customerId: string;
  type: 'CREDIT' | 'PAYMENT' | 'REFUND';
  amount: number;
  previousBalance: number;
  newBalance: number;
  notes: string | null;
  createdAt: string;
}

export const CustomerCredit: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // --- Queries ---
  const { data: customersData, isLoading: isCustomersLoading } = useQuery({
    queryKey: ['credit-customers', search],
    queryFn: async () => {
      const res = await api.get('/master/customers', {
        params: { limit: 50, search }
      });
      return res.data.data.customers as Customer[];
    }
  });

  const { data: ledgerData, isLoading: isLedgerLoading } = useQuery({
    queryKey: ['customer-ledger', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const res = await api.get(`/finance/credit/ledger/${selectedCustomerId}`);
      return res.data.data.ledger as LedgerEntry[];
    },
    enabled: !!selectedCustomerId
  });

  // --- Mutations ---
  const payMutation = useMutation({
    mutationFn: async (payload: { customerId: string; amount: number; notes?: string }) => {
      const res = await api.post('/finance/credit/pay', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-ledger', selectedCustomerId] });
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      setFormError(null);
    },
    onError: (err) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errMsg = (err as any).response?.data?.error?.message || 'Payment submission failed.';
      setFormError(errMsg);
    }
  });

  const selectedCustomer = customersData?.find((c) => c.id === selectedCustomerId);

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedCustomerId) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid positive payment amount.');
      return;
    }

    payMutation.mutate({
      customerId: selectedCustomerId,
      amount: amt,
      notes: paymentNotes
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-8rem)] overflow-hidden">
      {/* Left Panel: Customer credit list */}
      <div className="lg:col-span-7 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="font-display font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="text-brand-blue-600" size={18} />
            <span>Customer Credit Accounts</span>
          </span>
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
            />
          </div>
        </div>

        {/* Customer Table */}
        <div className="flex-1 overflow-y-auto">
          {isCustomersLoading ? (
            <div className="flex items-center justify-center h-full py-12">
              <Loader2 className="animate-spin text-brand-blue-600" size={32} />
            </div>
          ) : customersData?.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No customers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 font-semibold border-b border-slate-100">
                    <th className="px-4 py-3">Customer Details</th>
                    <th className="px-4 py-3">Credit Limit</th>
                    <th className="px-4 py-3">Outstanding Bal</th>
                    <th className="px-4 py-3">Available Credit</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customersData?.map((customer) => {
                    const isSelected = customer.id === selectedCustomerId;
                    const availableCredit = Math.max(0, customer.creditLimit - customer.outstandingBalance);
                    return (
                      <tr 
                        key={customer.id} 
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors text-slate-700
                          ${isSelected ? 'bg-brand-blue-50/20 font-medium' : ''}
                        `}
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">{customer.name}</div>
                          <div className="text-slate-400 text-[10px] mt-0.5">{customer.phone}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">₹{customer.creditLimit.toFixed(2)}</td>
                        <td className={`px-4 py-3.5 font-bold ${customer.outstandingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          ${customer.outstandingBalance.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">₹{availableCredit.toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <button 
                            disabled={customer.outstandingBalance <= 0}
                            onClick={() => {
                              setSelectedCustomerId(customer.id);
                              setIsPaymentModalOpen(true);
                            }}
                            className="btn-primary px-3 py-1 text-[10px] rounded-lg disabled:opacity-50"
                          >
                            Receive Payment
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Selected Customer Ledger Timeline */}
      <div className="lg:col-span-5 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
        {/* Ledger Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <span className="font-display font-bold text-slate-800 flex items-center gap-2">
            <History className="text-brand-blue-600" size={18} />
            <span>Credit Ledger History</span>
          </span>
        </div>

        {/* Ledger Timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedCustomerId ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
              <History size={32} className="stroke-1" />
              <p>Select a customer to view credit history.</p>
            </div>
          ) : isLedgerLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-brand-blue-600" size={24} />
            </div>
          ) : ledgerData?.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">No credit transactions recorded.</div>
          ) : (
            <div className="relative border-l-2 border-slate-100 pl-4 ml-2 space-y-6">
              {ledgerData?.map((entry) => {
                const isCredit = entry.type === 'CREDIT';
                return (
                  <div key={entry.id} className="relative">
                    {/* Circle marker */}
                    <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white
                      ${isCredit ? 'bg-red-500' : 'bg-emerald-500'}`} 
                    />
                    <div className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`font-bold ${isCredit ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isCredit ? '+' : '-'}${entry.amount.toFixed(2)}
                      </span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold uppercase">
                        {entry.type}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 italic">{entry.notes || '-'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Balance: ${entry.previousBalance.toFixed(2)} → <span className="font-semibold text-slate-700">₹{entry.newBalance.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Receive Payment Modal */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-display font-bold text-slate-800">Receive Credit Payment</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedCustomer.name}</p>
              </div>
              <button 
                onClick={() => { setIsPaymentModalOpen(false); setFormError(null); }} 
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="py-4 space-y-4">
              {/* Outstanding Summary */}
              <div className="bg-slate-50 p-3 rounded-xl flex justify-between text-xs font-semibold text-slate-600">
                <span>Outstanding Balance:</span>
                <span className="text-red-600">₹{selectedCustomer.outstandingBalance.toFixed(2)}</span>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Payment Amount *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs font-semibold">₹</span>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    max={selectedCustomer.outstandingBalance}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount received..."
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Payment Notes / Reference</label>
                <input 
                  type="text" 
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Check #102, Cash payment"
                  className="form-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setIsPaymentModalOpen(false); setFormError(null); }} 
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={payMutation.isPending}
                  className="btn-primary px-4 py-2 text-xs"
                >
                  {payMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Coins size={14} />
                      <span>Receive Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerCredit;
