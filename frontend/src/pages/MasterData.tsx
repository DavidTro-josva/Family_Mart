import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Edit2, 
  Trash2, 
  Package, 
  FolderTree, 
  Truck, 
  Users, 
  UserSquare2,
  Loader2,
  X
} from 'lucide-react';
import api from '../services/api.ts';

// --- Type Definitions ---
interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  subCategories?: SubCategory[];
}

interface SubCategory {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: Category;
}

interface Brand {
  id: string;
  name: string;
  description?: string;
}

interface GstCategory {
  id: string;
  name: string;
  rate: number;
  description?: string;
}

interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  gstIn?: string;
  pan?: string;
  address?: string;
  creditPeriod: number;
  creditLimit: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  creditLimit: number;
  outstandingBalance: number;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  designation: string;
  salary: number;
  user: {
    email: string;
    username: string;
    role: string;
  };
}

interface Product {
  id: string;
  name: string;
  description?: string;
  barcode: string;

  hsnCode?: string;
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  minStock: number;
  reorderLevel: number;
  openingStock: number;
  unit: Unit;
  subCategory: SubCategory;
  brand: Brand;
  gstCategory: GstCategory;
  supplier: Supplier;
  warehouseStocks?: { quantity: number }[];
}

type TabType = 'products' | 'categories' | 'suppliers' | 'customers' | 'employees';

export const MasterData: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Fetch Queries ---
  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn: async () => {
      const res = await api.get('/master/products', {
        params: { search, page, limit: 8 }
      });
      return res.data.data;
    },
    enabled: activeTab === 'products'
  });

  const { data: categoriesData, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/master/categories');
      return res.data.data.categories as Category[];
    },
    enabled: activeTab === 'categories'
  });

  const { data: suppliersData, isLoading: isSuppliersLoading } = useQuery({
    queryKey: ['suppliers', search, page],
    queryFn: async () => {
      const res = await api.get('/master/suppliers', {
        params: { search, page, limit: 8 }
      });
      return res.data.data;
    },
    enabled: activeTab === 'suppliers'
  });

  const { data: customersData, isLoading: isCustomersLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: async () => {
      const res = await api.get('/master/customers', {
        params: { search, page, limit: 8 }
      });
      return res.data.data;
    },
    enabled: activeTab === 'customers'
  });

  const { data: employeesData, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['employees', search, page],
    queryFn: async () => {
      const res = await api.get('/master/employees', {
        params: { search, page, limit: 8 }
      });
      return res.data.data;
    },
    enabled: activeTab === 'employees'
  });

  // --- CSV Export Helper ---
  const exportToCSV = () => {
    if (activeTab === 'products' && productsData?.products) {
      const headers = ['Name', 'Barcode', 'Cost Price', 'Selling Price', 'MRP', 'Stock'];
      const rows = productsData.products.map((p: Product) => [
        p.name,
        p.barcode,

        p.costPrice,
        p.sellingPrice,
        p.mrp,
        p.openingStock
      ]);
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map((e: string[]) => e.join(','))].join('\n');
        
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "family_mart_products.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const tabs = [
    { id: 'products', name: 'Products', icon: Package },
    { id: 'categories', name: 'Categories', icon: FolderTree },
    { id: 'suppliers', name: 'Suppliers', icon: Truck },
    { id: 'customers', name: 'Customers', icon: Users },
    { id: 'employees', name: 'Employees', icon: UserSquare2 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-6">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-800">Master Data Control Panel</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage products, suppliers, customer credit limits, and system employees.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="btn-secondary px-4 py-2 text-sm shrink-0"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary px-4 py-2 text-sm shrink-0"
          >
            <Plus size={16} />
            <span>Add New</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 shadow-sm max-w-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as TabType);
                setSearch('');
                setPage(1);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${isActive 
                  ? 'bg-gradient-to-r from-brand-blue-600 to-brand-blue-500 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
            >
              <Icon size={16} />
              <span className="hidden md:inline">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters Bar */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-150 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
          />
        </div>
        <button className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600">
          <Filter size={16} />
        </button>
      </div>

      {/* Table / Content Display */}
      <div className="glass-card overflow-hidden">
        {activeTab === 'products' && (
          <div className="overflow-x-auto">
            {isProductsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-brand-blue-600" size={32} />
              </div>
            ) : productsData?.products?.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No products found.</div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="px-6 py-4">Product Name</th>
                    <th className="px-6 py-4">Barcode</th>
                    <th className="px-6 py-4">Cost Price</th>
                    <th className="px-6 py-4">Selling Price</th>
                    <th className="px-6 py-4">MRP</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productsData?.products?.map((product: Product) => (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{product.name}</td>
                      <td className="px-6 py-4 text-slate-500">
                        <div>{product.barcode}</div>

                      </td>
                      <td className="px-6 py-4 text-slate-700">₹{product.costPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 font-semibold text-brand-blue-700">₹{product.sellingPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-slate-500">₹{product.mrp.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium 
                          ${(product.warehouseStocks?.reduce((acc, ws) => acc + ws.quantity, 0) ?? product.openingStock) <= product.reorderLevel 
                            ? 'bg-red-50 text-red-700' 
                            : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {product.warehouseStocks?.reduce((acc, ws) => acc + ws.quantity, 0) ?? product.openingStock} {product.unit.abbreviation}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800">
                          <Edit2 size={15} />
                        </button>
                        <button className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="p-6">
            {isCategoriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-brand-blue-600" size={32} />
              </div>
            ) : categoriesData?.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No categories found.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {categoriesData?.map((cat: Category) => (
                  <div key={cat.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                    <h3 className="font-bold text-slate-800">{cat.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{cat.description || 'No description'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {cat.subCategories?.map((sub: SubCategory) => (
                        <span key={sub.id} className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium">
                          {sub.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Views for Suppliers, Customers, Employees with table layouts */}
        {(activeTab === 'suppliers' || activeTab === 'customers' || activeTab === 'employees') && (
          <div className="overflow-x-auto">
            {((activeTab === 'suppliers' && isSuppliersLoading) || 
              (activeTab === 'customers' && isCustomersLoading) || 
              (activeTab === 'employees' && isEmployeesLoading)) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-brand-blue-600" size={32} />
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Contact / Phone</th>
                    <th className="px-6 py-4">Email</th>
                    {activeTab === 'suppliers' && <th className="px-6 py-4">GSTIN / PAN</th>}
                    {activeTab === 'customers' && <th className="px-6 py-4">Credit Limit</th>}
                    {activeTab === 'employees' && <th className="px-6 py-4">Designation</th>}
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab === 'suppliers' && suppliersData?.suppliers?.map((sup: Supplier) => (
                    <tr key={sup.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{sup.name}</td>
                      <td className="px-6 py-4 text-slate-600">{sup.phone || '-'}</td>
                      <td className="px-6 py-4 text-slate-500">{sup.email || '-'}</td>
                      <td className="px-6 py-4 text-slate-500">
                        <div>{sup.gstIn || '-'}</div>
                        <div className="text-xs text-slate-400">{sup.pan || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === 'customers' && customersData?.customers?.map((cust: Customer) => (
                    <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{cust.name}</td>
                      <td className="px-6 py-4 text-slate-600">{cust.phone}</td>
                      <td className="px-6 py-4 text-slate-500">{cust.email || '-'}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700">₹{cust.creditLimit.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === 'employees' && employeesData?.employees?.map((emp: Employee) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{emp.firstName} {emp.lastName}</td>
                      <td className="px-6 py-4 text-slate-600">{emp.phone || '-'}</td>
                      <td className="px-6 py-4 text-slate-500">{emp.user.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                          {emp.designation}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {activeTab !== 'categories' && (
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-slate-155 shadow-sm">
          <span className="text-xs text-slate-500">Showing page {page}</span>
          <div className="flex gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-medium rounded-lg transition-colors"
            >
              Previous
            </button>
            <button 
              onClick={() => setPage(p => p + 1)}
              className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Scaffolding Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-slate-100 shadow-2xl rounded-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-display font-bold text-slate-800">Add New {activeTab.slice(0, -1)}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="py-6 text-sm text-slate-500">
              Form schema mapping for {activeTab} is configured. Click below to submit mock data.
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => setIsModalOpen(false)} className="btn-primary px-4 py-2 text-sm">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterData;
