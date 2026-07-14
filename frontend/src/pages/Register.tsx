import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FolderLock, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldAlert, 
  Clock, 
  Loader2, 
  ChevronRight,
  AlertCircle,
  X
} from 'lucide-react';
import api from '../services/api.ts';

// --- Type Definitions ---
interface RegisterSession {
  id: string;
  cashierId: string;
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  status: 'OPEN' | 'CLOSED';
  notes: string | null;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  safeDrops: number;
}

export const Register: React.FC = () => {
  const queryClient = useQueryClient();
  
  // --- States ---
  const [openingFloat, setOpeningFloat] = useState<string>('100.00');
  const [actualCash, setActualCash] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState('');
  
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'CASH_IN' | 'CASH_OUT' | 'SAFE_DROP'>('SAFE_DROP');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txDescription, setTxDescription] = useState('');
  
  const [error, setError] = useState<string | null>(null);

  // --- Queries ---
  const { data: registerData, isLoading } = useQuery({
    queryKey: ['active-register'],
    queryFn: async () => {
      const res = await api.get('/finance/register/active');
      return res.data.data.session as RegisterSession | null;
    }
  });

  // --- Mutations ---
  const openMutation = useMutation({
    mutationFn: async (float: number) => {
      const res = await api.post('/finance/register/open', { openingFloat: float });
      return res.data.data.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-register'] });
      setError(null);
    },
    onError: (err) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any).response?.data?.error?.message || 'Failed to open register.');
    }
  });

  const closeMutation = useMutation({
    mutationFn: async (payload: { actualCash: number; notes?: string }) => {
      const res = await api.post('/finance/register/close', payload);
      return res.data.data.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-register'] });
      setActualCash('');
      setCloseNotes('');
      setError(null);
    },
    onError: (err) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any).response?.data?.error?.message || 'Failed to close register.');
    }
  });

  const txMutation = useMutation({
    mutationFn: async (payload: { type: string; amount: number; description: string }) => {
      const res = await api.post('/finance/register/transaction', payload);
      return res.data.data.transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-register'] });
      setIsTxModalOpen(false);
      setTxAmount('');
      setTxDescription('');
      setError(null);
    },
    onError: (err) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any).response?.data?.error?.message || 'Failed to record drawer transaction.');
    }
  });

  const handleOpenRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const float = parseFloat(openingFloat);
    if (isNaN(float) || float < 0) {
      setError('Please enter a valid opening float.');
      return;
    }
    openMutation.mutate(float);
  };

  const handleCloseRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const actual = parseFloat(actualCash);
    if (isNaN(actual) || actual < 0) {
      setError('Please enter a valid actual cash amount.');
      return;
    }
    closeMutation.mutate({ actualCash: actual, notes: closeNotes });
  };

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(txAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!txDescription.trim()) {
      setError('Please enter a description.');
      return;
    }
    txMutation.mutate({ type: txType, amount: amt, description: txDescription });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-brand-blue-600" size={32} />
      </div>
    );
  }

  // --- Render Closed State ---
  if (!registerData) {
    return (
      <div className="max-w-md mx-auto py-12 space-y-6">
        <div className="glass-card p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
            <FolderLock size={24} />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-slate-800">Register is Closed</h2>
            <p className="text-slate-500 text-sm mt-1">To begin processing sales, please open your register session with an opening float.</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 text-left">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleOpenRegister} className="space-y-4 pt-2 text-left">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Opening Float *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs font-semibold">₹</span>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={openMutation.isPending}
              className="w-full py-3 bg-brand-blue-600 hover:bg-brand-blue-700 text-white font-bold rounded-xl shadow-lg shadow-brand-blue-500/10 hover:shadow-brand-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              {openMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Opening Register...</span>
                </>
              ) : (
                <>
                  <Coins size={16} />
                  <span>Open Register Shift</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render Open State ---
  const currentExpected = registerData.expectedCash;
  const computedVariance = actualCash ? parseFloat(actualCash) - currentExpected : 0;

  return (
    <div className="space-y-6">
      {/* Top Session Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl font-display font-bold text-slate-800">Active Register Session</h2>
          </div>
          <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
            <Clock size={14} />
            <span>Shift opened on {new Date(registerData.openedAt).toLocaleString()}</span>
          </p>
        </div>
        <div>
          <button 
            onClick={() => setIsTxModalOpen(true)}
            className="btn-secondary px-4 py-2 text-sm"
          >
            <ArrowUpRight size={16} />
            <span>Drawer Transaction</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Cash Register Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 border-l-4 border-l-slate-400">
          <span className="text-xs font-semibold text-slate-400 uppercase">Opening Float</span>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">₹{registerData.openingFloat.toFixed(2)}</h3>
          <p className="text-xs text-slate-500 mt-2">Cash float at shift start</p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-brand-green-500">
          <span className="text-xs font-semibold text-slate-400 uppercase">Cash Sales</span>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">₹{registerData.cashSales.toFixed(2)}</h3>
          <p className="text-xs text-slate-500 mt-2">Cash sales processed on POS</p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-slate-400 uppercase">Inflow / Outflow</span>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">
            +${registerData.cashIn.toFixed(2)} / -${(registerData.cashOut + registerData.safeDrops).toFixed(2)}
          </h3>
          <p className="text-xs text-slate-500 mt-2">Drops, withdrawals & transactions</p>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-brand-blue-500 bg-brand-blue-50/5">
          <span className="text-xs font-semibold text-brand-blue-600 uppercase">Expected Drawer Cash</span>
          <h3 className="text-2xl font-black text-brand-blue-700 mt-1">₹{currentExpected.toFixed(2)}</h3>
          <p className="text-xs text-brand-blue-600/75 font-medium mt-2">Expected total cash in drawer</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Close Register Shift Form */}
        <form onSubmit={handleCloseRegister} className="lg:col-span-7 glass-card p-6 space-y-6">
          <h3 className="font-display font-bold text-slate-800 text-lg border-b border-slate-100 pb-2">Close Register (End Shift)</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Expected Cash display */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-1">
              <span className="text-xs text-slate-500 font-semibold">Expected Cash</span>
              <div className="text-xl font-bold text-slate-700">₹{currentExpected.toFixed(2)}</div>
            </div>

            {/* Actual Cash Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Actual Cash Counted *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs font-semibold">₹</span>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="Count cash in drawer..."
                  className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Variance Indicator */}
          {actualCash && (
            <div className={`p-4 rounded-xl flex items-center justify-between border
              ${computedVariance === 0 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : computedVariance > 0 
                ? 'bg-blue-50 border-brand-blue-200 text-brand-blue-800' 
                : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} />
                <span className="text-xs font-semibold">Reconciliation Variance</span>
              </div>
              <div className="text-lg font-bold">
                {computedVariance >= 0 ? '+' : ''}${computedVariance.toFixed(2)}
              </div>
            </div>
          )}

          {/* Close Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Shift Closing Notes / Observations</label>
            <textarea 
              rows={3}
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Record any reasons for discrepancies, shift handover notes, etc..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={closeMutation.isPending}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/10 hover:shadow-red-500/20 transition-all flex items-center gap-2"
            >
              {closeMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Closing Session...</span>
                </>
              ) : (
                <>
                  <FolderLock size={16} />
                  <span>Reconcile & Close Register</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right Panel: Informational Card */}
        <div className="lg:col-span-5 glass-card p-6 space-y-4 bg-slate-50/20 border-dashed">
          <h4 className="font-display font-bold text-slate-800 text-base">Reconciliation Guide</h4>
          <p className="text-slate-500 text-xs leading-relaxed">
            At the end of your shift, you must perform a physical cash count. Enter the exact cash amount present in the drawer.
          </p>
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <ChevronRight className="text-brand-blue-600 shrink-0 mt-0.5" size={16} />
              <span>Ensure all cash drops (safe drops) have been recorded.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <ChevronRight className="text-brand-blue-600 shrink-0 mt-0.5" size={16} />
              <span>A variance of ₹0.00 indicates a perfect drawer balance.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <ChevronRight className="text-brand-blue-600 shrink-0 mt-0.5" size={16} />
              <span>Any variance will be logged and audited by the store manager.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer Transaction Modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-display font-bold text-slate-800">Drawer Transaction</h3>
              <button 
                onClick={() => { setIsTxModalOpen(false); }} 
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTxSubmit} className="py-4 space-y-4">
              {/* Transaction Type */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Transaction Type *</label>
                <select 
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as 'CASH_IN' | 'CASH_OUT' | 'SAFE_DROP')}
                  className="form-input text-xs"
                >
                  <option value="SAFE_DROP">Safe Drop (Cash to Safe)</option>
                  <option value="CASH_OUT">Cash Out (Petty Cash Withdrawal)</option>
                  <option value="CASH_IN">Cash In (Float Addition)</option>
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Amount *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs font-semibold">₹</span>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="Enter amount..."
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Description / Reason *</label>
                <input 
                  type="text" 
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="e.g. Safe Drop #3, Petty cash for cleaning"
                  className="form-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setIsTxModalOpen(false); }} 
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={txMutation.isPending}
                  className="btn-primary px-4 py-2 text-xs"
                >
                  {txMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      {txType === 'CASH_IN' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      <span>Record Transaction</span>
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

export default Register;
