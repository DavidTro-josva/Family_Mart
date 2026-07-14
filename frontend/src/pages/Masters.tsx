import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Loader2,
  Settings,
  Scale,
  CreditCard,
  Landmark,
  X,
  Edit2
} from 'lucide-react';
import api from '../services/api.ts';

interface Unit { id: string; name: string; abbreviation: string; }
interface PaymentType { id: string; name: string; description?: string; isActive: boolean; }
interface BankAccount { id: string; accountName: string; accountNumber: string; bankName: string; branch?: string; ifscCode?: string; isActive: boolean; }

type Tab = 'UNITS' | 'PAYMENTS' | 'BANKS';

export const Masters: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('UNITS');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Modal State
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);

  // Form States
  const [unitForm, setUnitForm] = useState({ name: '', abbreviation: '' });
  const [paymentForm, setPaymentForm] = useState({ name: '', description: '' });
  const [bankForm, setBankForm] = useState({ accountName: '', accountNumber: '', bankName: '', branch: '', ifscCode: '' });

  // --- Queries ---
  const { data: units = [], isLoading: isLoadingUnits } = useQuery({
    queryKey: ['units'],
    queryFn: async () => (await api.get('/master/units')).data.data.units as Unit[]
  });

  const { data: paymentTypes = [], isLoading: isLoadingPayments } = useQuery({
    queryKey: ['payment-types'],
    queryFn: async () => (await api.get('/master/payment-types')).data.data.paymentTypes as PaymentType[]
  });

  const { data: bankAccounts = [], isLoading: isLoadingBanks } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async () => (await api.get('/master/bank-accounts')).data.data.bankAccounts as BankAccount[]
  });

  // --- Mutations ---
  const createUnit = useMutation({
    mutationFn: async (payload: typeof unitForm) => await api.post('/master/units', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setIsUnitModalOpen(false);
      setUnitForm({ name: '', abbreviation: '' });
    }
  });

  const createPaymentType = useMutation({
    mutationFn: async (payload: typeof paymentForm) => await api.post('/master/payment-types', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-types'] });
      setIsPaymentModalOpen(false);
      setPaymentForm({ name: '', description: '' });
    }
  });

  const createBankAccount = useMutation({
    mutationFn: async (payload: typeof bankForm) => await api.post('/master/bank-accounts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      setIsBankModalOpen(false);
      setBankForm({ accountName: '', accountNumber: '', bankName: '', branch: '', ifscCode: '' });
    }
  });

  const updateBankAccount = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: typeof bankForm }) => await api.put(`/master/bank-accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      setIsBankModalOpen(false);
      setEditingBankId(null);
      setBankForm({ accountName: '', accountNumber: '', bankName: '', branch: '', ifscCode: '' });
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-brand-blue-600" />
            Master Data Configuration
          </h2>
          <p className="text-slate-500 text-sm mt-1">Manage system-wide dropdowns and options.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-full max-w-2xl">
        <button
          onClick={() => setActiveTab('UNITS')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200
            ${activeTab === 'UNITS' ? 'bg-white text-brand-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}
          `}
        >
          <Scale size={16} /> Unit Types
        </button>
        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200
            ${activeTab === 'PAYMENTS' ? 'bg-white text-brand-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}
          `}
        >
          <CreditCard size={16} /> Payment Types
        </button>
        <button
          onClick={() => setActiveTab('BANKS')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200
            ${activeTab === 'BANKS' ? 'bg-white text-brand-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}
          `}
        >
          <Landmark size={16} /> Bank Accounts
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-500/20 focus:border-brand-blue-500"
            />
          </div>
          <button 
            onClick={() => {
              if (activeTab === 'UNITS') setIsUnitModalOpen(true);
              if (activeTab === 'PAYMENTS') setIsPaymentModalOpen(true);
              if (activeTab === 'BANKS') {
                setEditingBankId(null);
                setBankForm({ accountName: '', accountNumber: '', bankName: '', branch: '', ifscCode: '' });
                setIsBankModalOpen(true);
              }
            }}
            className="btn-primary py-2 text-sm"
          >
            <Plus size={16} /> Add New
          </button>
        </div>

        {/* Tables */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              {activeTab === 'UNITS' && (
                <tr>
                  <th className="px-6 py-4">Unit Name</th>
                  <th className="px-6 py-4">Abbreviation</th>
                </tr>
              )}
              {activeTab === 'PAYMENTS' && (
                <tr>
                  <th className="px-6 py-4">Payment Type</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              )}
              {activeTab === 'BANKS' && (
                <tr>
                  <th className="px-6 py-4">Account Name</th>
                  <th className="px-6 py-4">Bank & Branch</th>
                  <th className="px-6 py-4">Account Number</th>
                  <th className="px-6 py-4">IFSC</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTab === 'UNITS' && (
                isLoadingUnits ? <tr><td colSpan={2} className="px-6 py-8 text-center"><Loader2 className="animate-spin inline text-brand-blue-600" /></td></tr>
                : units.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                    <td className="px-6 py-4">{u.abbreviation}</td>
                  </tr>
                ))
              )}
              
              {activeTab === 'PAYMENTS' && (
                isLoadingPayments ? <tr><td colSpan={3} className="px-6 py-8 text-center"><Loader2 className="animate-spin inline text-brand-blue-600" /></td></tr>
                : paymentTypes.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                    <td className="px-6 py-4">{p.description || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}

              {activeTab === 'BANKS' && (
                isLoadingBanks ? <tr><td colSpan={4} className="px-6 py-8 text-center"><Loader2 className="animate-spin inline text-brand-blue-600" /></td></tr>
                : bankAccounts.filter(b => b.accountName.toLowerCase().includes(searchTerm.toLowerCase()) || b.bankName.toLowerCase().includes(searchTerm.toLowerCase())).map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{b.accountName}</td>
                    <td className="px-6 py-4">{b.bankName} {b.branch ? `(${b.branch})` : ''}</td>
                    <td className="px-6 py-4 font-mono text-xs">{b.accountNumber}</td>
                    <td className="px-6 py-4 font-mono text-xs">{b.ifscCode || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unit Modal */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">New Unit Type</h3>
              <button onClick={() => setIsUnitModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Unit Name</label>
                <input type="text" className="form-input" value={unitForm.name} onChange={e => setUnitForm({...unitForm, name: e.target.value})} placeholder="e.g. Kilogram" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Abbreviation</label>
                <input type="text" className="form-input" value={unitForm.abbreviation} onChange={e => setUnitForm({...unitForm, abbreviation: e.target.value})} placeholder="e.g. Kg" />
              </div>
              <button onClick={() => createUnit.mutate(unitForm)} disabled={createUnit.isPending} className="btn-primary w-full mt-4">
                {createUnit.isPending ? <Loader2 className="animate-spin" size={18} /> : 'Save Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Type Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">New Payment Type</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Type Name</label>
                <input type="text" className="form-input" value={paymentForm.name} onChange={e => setPaymentForm({...paymentForm, name: e.target.value})} placeholder="e.g. HDFC Card Machine" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <input type="text" className="form-input" value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} placeholder="e.g. Swipe machine at counter 1" />
              </div>
              <button onClick={() => createPaymentType.mutate(paymentForm)} disabled={createPaymentType.isPending} className="btn-primary w-full mt-4">
                {createPaymentType.isPending ? <Loader2 className="animate-spin" size={18} /> : 'Save Payment Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Account Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">{editingBankId ? 'Edit Bank Account' : 'New Bank Account'}</h3>
              <button onClick={() => { setIsBankModalOpen(false); setEditingBankId(null); setBankForm({ accountName: '', accountNumber: '', bankName: '', branch: '', ifscCode: '' }); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Account Name / Label</label>
                <input type="text" className="form-input" value={bankForm.accountName} onChange={e => setBankForm({...bankForm, accountName: e.target.value})} placeholder="e.g. HDFC Current Acc" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Bank Name</label>
                <input type="text" className="form-input" value={bankForm.bankName} onChange={e => setBankForm({...bankForm, bankName: e.target.value})} placeholder="e.g. HDFC Bank" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Account Number</label>
                <input type="text" className="form-input" value={bankForm.accountNumber} onChange={e => setBankForm({...bankForm, accountNumber: e.target.value})} placeholder="e.g. 50200012345678" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Branch</label>
                  <input type="text" className="form-input" value={bankForm.branch} onChange={e => setBankForm({...bankForm, branch: e.target.value})} placeholder="e.g. Main Branch" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">IFSC Code</label>
                  <input type="text" className="form-input" value={bankForm.ifscCode} onChange={e => setBankForm({...bankForm, ifscCode: e.target.value})} placeholder="e.g. HDFC0001234" />
                </div>
              </div>
              <button 
                onClick={() => editingBankId ? updateBankAccount.mutate({ id: editingBankId, data: bankForm }) : createBankAccount.mutate(bankForm)} 
                disabled={createBankAccount.isPending || updateBankAccount.isPending} 
                className="btn-primary w-full mt-4"
              >
                {createBankAccount.isPending || updateBankAccount.isPending ? <Loader2 className="animate-spin inline" size={18} /> : (editingBankId ? 'Update Bank Account' : 'Save Bank Account')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Masters;
