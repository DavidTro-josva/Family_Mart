import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Plus, 
  Loader2,
  X,
  UserCheck,
  Trash2,
  Mail,
  Briefcase,
  Edit
} from 'lucide-react';
import api from '../services/api.ts';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  designation: string;
  salary: number;
  user: {
    username: string;
    email: string;
    role: string;
  };
}

export const EmployeeManagement: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  // --- Form States ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [salary, setSalary] = useState(0);
  
  // Inline User Account details
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'CASHIER' | 'INVENTORY_CLERK'>('CASHIER');
  const [formError, setFormError] = useState<string | null>(null);

  // --- Query ---
  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['employees', search],
    queryFn: async () => {
      const res = await api.get('/master/employees', { params: { limit: 100 } });
      return res.data.data.employees as Employee[];
    }
  });

  // --- Mutations ---
  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/master/employees', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      const errMsg = (err as any).response?.data?.error?.message || 'Failed to add employee.';
      setFormError(errMsg);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/master/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    }
  });

  const editMutation = useMutation({
    mutationFn: async (payload: { id: string; data: any }) => {
      const res = await api.put(`/master/employees/${payload.id}`, payload.data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      const errMsg = (err as any).response?.data?.error?.message || 'Failed to update employee.';
      setFormError(errMsg);
    }
  });

  const handleEditClick = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setFirstName(emp.firstName);
    setLastName(emp.lastName);
    setPhone(emp.phone || '');
    setDesignation(emp.designation);
    setSalary(emp.salary);
    setUsername(emp.user.username);
    setEmail(emp.user.email);
    setPassword(''); // don't populate password
    setRole(emp.user.role as any);
    setFormError(null);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingEmployeeId(null);
    setFirstName('');
    setLastName('');
    setPhone('');
    setDesignation('');
    setSalary(0);
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('CASHIER');
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!firstName || !designation || !username || !email || (!password && !editingEmployeeId)) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const payload = {
      firstName,
      lastName,
      phone: phone || undefined,
      designation,
      salary: Number(salary),
      username,
      email,
      ...(password && { password }),
      role
    };

    if (editingEmployeeId) {
      editMutation.mutate({ id: editingEmployeeId, data: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const filteredEmployees = employeesData?.filter(emp => 
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    emp.designation.toLowerCase().includes(search.toLowerCase()) ||
    emp.user.username.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Top Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-6">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-800">Employee Management</h2>
          <p className="text-slate-500 text-sm mt-0.5">Configure system users, cashier registers, and staff credentials.</p>
        </div>
        <button 
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary px-4 py-2 text-sm shrink-0"
        >
          <Plus size={16} />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-150 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search employees by name, designation, username..."
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
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No employees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <th className="px-6 py-4">Employee Name</th>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Salary</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{emp.firstName} {emp.lastName}</div>
                      <div className="text-xs text-slate-400">{emp.user.email}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{emp.user.username}</td>
                    <td className="px-6 py-4">{emp.designation}</td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                        {emp.user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">₹{emp.salary.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEditClick(emp)}
                          className="p-1.5 hover:bg-brand-blue-50 text-slate-400 hover:text-brand-blue-600 rounded-lg transition-colors"
                          title="Edit Employee"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove ${emp.firstName} ${emp.lastName}?`)) {
                              deleteMutation.mutate(emp.id);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Delete Employee"
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

      {/* Add Employee Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto sm:p-6">
          <div className="w-full max-w-xl bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 my-8 shrink-0">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-display font-bold text-slate-800">
                {editingEmployeeId ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{formError}</div>}
              
              <h4 className="text-xs font-bold text-brand-blue-600 uppercase tracking-wider">Personal Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">First Name *</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Designation *</label>
                  <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" placeholder="Cashier / Clerk" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Salary</label>
                  <input type="number" value={salary} onChange={(e) => setSalary(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Phone</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" />
                </div>
              </div>

              <h4 className="text-xs font-bold text-brand-blue-600 uppercase tracking-wider pt-2 border-t">User Account Credentials</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Username *</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" placeholder="E.g., clerk123" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Email Address *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" placeholder="clerk@store.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Password {editingEmployeeId ? '(Leave blank to keep)' : '*'}
                  </label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none" placeholder={editingEmployeeId ? 'Min 6 characters' : 'Min 6 characters'} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">System Role *</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none bg-white">
                    <option value="CASHIER">Cashier (POS & Sales)</option>
                    <option value="INVENTORY_CLERK">Inventory Clerk</option>
                    <option value="MANAGER">Store Manager</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-4 py-2">Cancel</button>
                <button type="submit" disabled={addMutation.isPending || editMutation.isPending} className="btn-primary px-4 py-2">
                  {addMutation.isPending || editMutation.isPending ? 'Saving...' : editingEmployeeId ? 'Save Changes' : 'Add Employee'}
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

export default EmployeeManagement;
