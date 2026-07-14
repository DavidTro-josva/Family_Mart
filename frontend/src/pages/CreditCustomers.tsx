import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Wallet, 
  Plus, 
  Loader2,
  X,
  History,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import api from '../services/api.ts';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  creditLimit: number;
  outstandingBalance: number;
}

export const CreditCustomers: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  // --- Selected Customer for Ledger / Payment ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // --- Customer Form States ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creditLimit, setCreditLimit] = useState(1000);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Payment Form States ---
  const [payAmount, setPayAmount] = useState(0);
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  // --- Query ---
  const { data: customersData, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      const res = await api.get('/master/customers', { params: { limit: 100 } });
      return res.data.data.customers as Customer[];
    }
  });

  // Filter to credit-only users (creditLimit > 0)
  const creditCustomers = customersData?.filter(c => 
    c.creditLimit > 0 && 
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
  ) || [];

  // --- Mutations ---
  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/master/customers', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      const errMsg = (err as any).response?.data?.error?.message || 'Failed to create customer.';
      setFormError(errMsg);
    }
  });

  const payMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/finance/credit/pay', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsPaymentModalOpen(false);
      setPayAmount(0);
      setPayNotes('');
      setPayError(null);
    },
    onError: (err) => {
      const errMsg = (err as any).response?.data?.error?.message || 'Failed to record payment.';
      setPayError(errMsg);
    }
  });

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCreditLimit(1000);
    setFormError(null);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name || !phone) {
      setFormError('Please enter a name and phone number.');
      return;
    }
    addMutation.mutate({
      name,
      phone,
      email: email || undefined,
      creditLimit: Number(creditLimit)
    });
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    if (!selectedCustomerId || payAmount <= 0) {
      setPayError('Please enter a valid payment amount.');
      return;
    }
    payMutation.mutate({
      customerId: selectedCustomerId,
      amount: Number(payAmount),
      notes: payNotes || 'Credit Repayment'
    });
  };

  // Metrics
  const totalCreditIssued = creditCustomers.reduce((acc, c) => acc + c.outstandingBalance, 0);
  const totalCreditLimit = creditCustomers.reduce((acc, c) => acc + c.creditLimit, 0);

  return (
    <div className="space-y-6">
      {/* Top Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-6">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-800">Credit Customers</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage credit limits, view outstanding balances, and post repayments.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary px-4 py-2 text-sm shrink-0"
        >
          <Plus size={16} />
          <span>Add Credit Customer</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-l-4 border-l-brand-blue-500">
          <span className="text-xs font-semibold text-slate-400 uppercase">Total Outstanding Balance</span>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">₹{totalCreditIssued.toFixed(2)}</h3>
          <p className="text-xs text-slate-500 mt-2">Active credit balance across all accounts</p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-brand-green-500">
          <span className="text-xs font-semibold text-slate-400 uppercase">Total Credit Limit</span>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">₹{totalCreditLimit.toFixed(2)}</h3>
          <p className="text-xs text-slate-500 mt-2">Maximum allowed store credit capacity</p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-slate-400 uppercase">Credit Utilisation</span>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">
            {totalCreditLimit > 0 ? ((totalCreditIssued / totalCreditLimit) * 100).toFixed(1) : '0.0'}%
          </h3>
          <p className="text-xs text-slate-500 mt-2">Outstanding relative to limit</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-150 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
          />
        </div>
      </div>

      {/* Table Display */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-brand-blue-600" size={32} />
          </div>
        ) : creditCustomers.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No credit customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="px-6 py-4">Customer Details</th>
                  <th className="px-6 py-4">Credit Limit</th>
                  <th className="px-6 py-4">Outstanding Balance</th>
                  <th className="px-6 py-4">Available Credit</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creditCustomers.map((c) => {
                  const availableCredit = Math.max(0, c.creditLimit - c.outstandingBalance);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{c.name}</div>
                        <div className="text-xs text-slate-400">{c.phone}</div>
                      </td>
                      <td className="px-6 py-4">₹{c.creditLimit.toFixed(2)}</td>
                      <td className={`px-6 py-4 font-bold ${c.outstandingBalance > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        ₹{c.outstandingBalance.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-emerald-600 font-semibold">₹{availableCredit.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setIsPaymentModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-brand-blue-50 hover:bg-brand-blue-100 text-brand-blue-700 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Record Payment
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

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-slate-100 shadow-2xl rounded-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-display font-bold text-slate-800">Add Credit Customer</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-4 py-4">
              {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{formError}</div>}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Customer Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Phone Number *</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" placeholder="10-digit number" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" placeholder="Optional" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Credit Limit (₹) *</label>
                <input type="number" value={creditLimit} onChange={(e) => setCreditLimit(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-4 py-2">Cancel</button>
                <button type="submit" disabled={addMutation.isPending} className="btn-primary px-4 py-2">
                  {addMutation.isPending ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Repayment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-slate-100 shadow-2xl rounded-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-display font-bold text-slate-800">Record Repayment</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-4 py-4">
              {payError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{payError}</div>}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Payment Amount (₹) *</label>
                <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Notes</label>
                <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Repayment details" className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="btn-secondary px-4 py-2">Cancel</button>
                <button type="submit" disabled={payMutation.isPending} className="btn-primary px-4 py-2">
                  {payMutation.isPending ? 'Posting...' : 'Post Repayment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditCustomers;
