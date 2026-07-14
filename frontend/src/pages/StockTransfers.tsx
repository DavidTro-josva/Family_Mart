import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api.js';
import { 
  ArrowLeftRight, 
  Plus, 
  Eye, 
  Check, 
  X, 
  Search, 
  Calendar, 
  Truck
} from 'lucide-react';

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;

  barcode: string;
}

interface StockTransferItem {
  id: string;
  productId: string;
  product: Product;
  quantityRequested: number;
  quantityDispatched: number;
  quantityReceived: number;
  quantityDamaged: number;
  quantityLost: number;
  status: 'PENDING' | 'DISPATCHED' | 'RECEIVED' | 'DAMAGED' | 'LOST';
  remarks: string | null;
}

interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouse: Warehouse;
  destinationWarehouseId: string;
  destinationWarehouse: Warehouse;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  createdById: string;
  createdBy: {
    username: string;
  };
  approvedById: string | null;
  approvedBy: {
    username: string;
  } | null;
  dispatchedById: string | null;
  dispatchedBy: {
    username: string;
  } | null;
  receivedById: string | null;
  receivedBy: {
    username: string;
  } | null;
  remarks: string | null;
  items: StockTransferItem[];
  createdAt: string;
}

interface NewTransferItemInput {
  productId: string;
  name: string;

  quantityRequested: number;
}

interface DispatchItemInput {
  itemId: string;
  quantityDispatched: number;
}

interface ReceiveItemInput {
  itemId: string;
  quantityReceived: number;
  quantityDamaged: number;
  quantityLost: number;
  remarks: string;
}

export const StockTransfers: React.FC = () => {
  const queryClient = useQueryClient();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  
  // Search & Filters
  const [transferSearch, setTransferSearch] = useState('');
  const [transferPage, setTransferPage] = useState(1);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);

  // New Transfer Request Wizard states
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferItems, setTransferItems] = useState<NewTransferItemInput[]>([]);
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState('');

  // Dispatch GIN states
  const [dispatchItems, setDispatchItems] = useState<DispatchItemInput[]>([]);

  // Receive GRN states
  const [receiveItems, setReceiveItems] = useState<ReceiveItemInput[]>([]);

  // Fetch Stock Transfers
  const { data: transfersData, isLoading: isTransfersLoading } = useQuery<{ data: StockTransfer[]; pagination: { total: number; page: number; limit: number; totalPages: number; } }>({
    queryKey: ['stock-transfers', transferSearch, activeTab, transferPage],
    queryFn: async () => {
      const statusFilter = activeTab === 'active' ? 'PENDING_APPROVAL,APPROVED,DISPATCHED' : 'RECEIVED,CANCELLED';
      const res = await api.get('/transfers', {
        params: {
          page: transferPage,
          limit: 8,
          search: transferSearch || undefined,
          status: statusFilter,
        },
      });
      return res.data;
    },
  });

  // Fetch Warehouses
  const { data: warehousesData } = useQuery<Warehouse[]>({
    queryKey: ['transfer-warehouses'],
    queryFn: async () => {
      const res = await api.get('/inventory/warehouses');
      return res.data.data;
    },
  });

  // Fetch Products (for lookup)
  const { data: productsData } = useQuery<Product[]>({
    queryKey: ['transfer-products'],
    queryFn: async () => {
      const res = await api.get('/master/products', { params: { limit: 100 } });
      return res.data.data;
    },
  });

  // Add Product to Wizard list
  const handleAddProduct = () => {
    if (!selectedProductIdToAdd || !productsData) return;
    
    const matched = productsData.find(p => p.id === selectedProductIdToAdd);
    if (!matched) return;

    // Check if already in list
    if (transferItems.some(item => item.productId === matched.id)) {
      alert('Product already added to request list');
      setSelectedProductIdToAdd('');
      return;
    }

    setTransferItems([
      ...transferItems,
      {
        productId: matched.id,
        name: matched.name,

        quantityRequested: 1,
      },
    ]);
    setSelectedProductIdToAdd('');
  };

  const handleQtyRequestedChange = (index: number, val: number) => {
    const updated = [...transferItems];
    updated[index].quantityRequested = Math.max(1, val);
    setTransferItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  // Mutation to Create STR
  const createTransferMutation = useMutation({
    mutationFn: async (data: { sourceWarehouseId: string; destinationWarehouseId: string; remarks?: string; items: { productId: string; quantityRequested: number; }[] }) => {
      const res = await api.post('/transfers', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
  });

  const resetCreateForm = () => {
    setSourceWarehouseId('');
    setDestinationWarehouseId('');
    setTransferRemarks('');
    setTransferItems([]);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWarehouseId || !destinationWarehouseId || transferItems.length === 0) return;

    createTransferMutation.mutate({
      sourceWarehouseId,
      destinationWarehouseId,
      remarks: transferRemarks,
      items: transferItems.map(item => ({
        productId: item.productId,
        quantityRequested: item.quantityRequested,
      })),
    });
  };

  // Mutation to Approve Transfer
  const approveTransferMutation = useMutation({
    mutationFn: async (transferId: string) => {
      const res = await api.post(`/transfers/${transferId}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
  });

  // Open Dispatch GIN Modal
  const openDispatchModal = async (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    // Initialize dispatch quantities
    const inputs: DispatchItemInput[] = transfer.items.map(item => ({
      itemId: item.id,
      quantityDispatched: item.quantityRequested, // Default dispatch = requested
    }));
    setDispatchItems(inputs);
    setIsDispatchModalOpen(true);
  };

  const handleQtyDispatchedChange = (index: number, val: number) => {
    const updated = [...dispatchItems];
    updated[index].quantityDispatched = Math.max(0, val);
    setDispatchItems(updated);
  };

  // Mutation to Dispatch GIN
  const dispatchTransferMutation = useMutation({
    mutationFn: async (data: { id: string; items: DispatchItemInput[] }) => {
      const res = await api.post(`/transfers/${data.id}/dispatch`, { items: data.items });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      setIsDispatchModalOpen(false);
      setSelectedTransfer(null);
    },
  });

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;

    dispatchTransferMutation.mutate({
      id: selectedTransfer.id,
      items: dispatchItems,
    });
  };

  // Open Receive GRN Modal
  const openReceiveModal = async (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    // Initialize receive quantities
    const inputs: ReceiveItemInput[] = transfer.items.map(item => ({
      itemId: item.id,
      quantityReceived: item.quantityDispatched, // Default receive = dispatched
      quantityDamaged: 0,
      quantityLost: 0,
      remarks: '',
    }));
    setReceiveItems(inputs);
    setIsReceiveModalOpen(true);
  };

  const handleReceiveItemChange = (index: number, field: keyof ReceiveItemInput, val: string | number) => {
    const updated = [...receiveItems];
    
    if (field === 'quantityReceived') {
      const num = Number(val);
      updated[index].quantityReceived = num;
      // Re-calculate lost/damaged to balance out
      const totalDispatched = selectedTransfer?.items[index].quantityDispatched || 0;
      updated[index].quantityLost = Math.max(0, totalDispatched - num - updated[index].quantityDamaged);
    } else if (field === 'quantityDamaged') {
      const num = Number(val);
      updated[index].quantityDamaged = num;
      // Re-calculate lost
      const totalDispatched = selectedTransfer?.items[index].quantityDispatched || 0;
      updated[index].quantityLost = Math.max(0, totalDispatched - updated[index].quantityReceived - num);
    } else if (field === 'quantityLost') {
      const num = Number(val);
      updated[index].quantityLost = num;
    } else if (field === 'remarks') {
      updated[index].remarks = val as string;
    }

    setReceiveItems(updated);
  };

  // Mutation to Receive & Reconcile GIN
  const receiveTransferMutation = useMutation({
    mutationFn: async (data: { id: string; items: ReceiveItemInput[] }) => {
      const res = await api.post(`/transfers/${data.id}/receive`, { items: data.items });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      setIsReceiveModalOpen(false);
      setSelectedTransfer(null);
    },
  });

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;

    // Validate balance for each item: received + damaged + lost should equal dispatched
    for (let i = 0; i < receiveItems.length; i++) {
      const input = receiveItems[i];
      const item = selectedTransfer.items[i];
      const sum = input.quantityReceived + input.quantityDamaged + input.quantityLost;
      if (sum !== item.quantityDispatched) {
        alert(`Quantities for ${item.product.name} must sum up to the dispatched amount of ${item.quantityDispatched}. Currently: ${sum}`);
        return;
      }
    }

    receiveTransferMutation.mutate({
      id: selectedTransfer.id,
      items: receiveItems,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'APPROVED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DISPATCHED': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'RECEIVED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CANCELLED': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-emerald-600" />
            Stock Transfers & GIN
          </h1>
          <p className="text-slate-500 text-sm mt-1">Request, dispatch, and reconcile inventory shipments across warehouses</p>
        </div>

        <button
          onClick={() => {
            resetCreateForm();
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Request Stock Transfer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('active');
            setTransferPage(1);
          }}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'active'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Active Transfers
        </button>
        <button
          onClick={() => {
            setActiveTab('completed');
            setTransferPage(1);
          }}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'completed'
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
              placeholder="Search transfer number..."
              value={transferSearch}
              onChange={(e) => {
                setTransferSearch(e.target.value);
                setTransferPage(1);
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
                <th className="py-4 px-6">Transfer ID</th>
                <th className="py-4 px-6">Source</th>
                <th className="py-4 px-6">Destination</th>
                <th className="py-4 px-6">Created By</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isTransfersLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Loading transfers...</td>
                </tr>
              ) : transfersData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No transfers found.</td>
                </tr>
              ) : (
                transfersData?.data?.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">{t.transferNumber}</td>
                    <td className="py-4 px-6 font-medium text-slate-600">{t.sourceWarehouse.name} ({t.sourceWarehouse.code})</td>
                    <td className="py-4 px-6 font-medium text-slate-600">{t.destinationWarehouse.name} ({t.destinationWarehouse.code})</td>
                    <td className="py-4 px-6 text-slate-500 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {t.createdBy.username}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex justify-center gap-2">
                        {t.status === 'PENDING_APPROVAL' && (
                          <button
                            onClick={() => approveTransferMutation.mutate(t.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 transition-all cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}

                        {t.status === 'APPROVED' && (
                          <button
                            onClick={() => openDispatchModal(t)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg border border-purple-100 transition-all cursor-pointer"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Dispatch (GIN)
                          </button>
                        )}

                        {t.status === 'DISPATCHED' && (
                          <button
                            onClick={() => openReceiveModal(t)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100 transition-all cursor-pointer"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            Receive & Verify
                          </button>
                        )}

                        <button
                          onClick={async () => {
                            const res = await api.get(`/transfers/${t.id}`);
                            setSelectedTransfer(res.data.data);
                            setIsDetailsModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {transfersData?.pagination && (
          <div className="p-5 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
            <p>Showing Page {transferPage} of {transfersData.pagination.totalPages || 1}</p>
            <div className="flex gap-2">
              <button
                disabled={transferPage === 1}
                onClick={() => setTransferPage(p => p - 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={transferPage === transfersData.pagination.totalPages}
                onClick={() => setTransferPage(p => p + 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE TRANSFER REQUEST MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
                Request Stock Transfer
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Source Warehouse (From)</label>
                  <select
                    required
                    value={sourceWarehouseId}
                    onChange={(e) => setSourceWarehouseId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-sm outline-none"
                  >
                    <option value="">Select Source</option>
                    {warehousesData?.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Destination Warehouse (To)</label>
                  <select
                    required
                    value={destinationWarehouseId}
                    onChange={(e) => setDestinationWarehouseId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-sm outline-none"
                  >
                    <option value="">Select Destination</option>
                    {warehousesData?.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Lookup */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Add Product to Request</label>
                  <select
                    value={selectedProductIdToAdd}
                    onChange={(e) => setSelectedProductIdToAdd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-sm outline-none"
                  >
                    <option value="">Select Product...</option>
                    {productsData?.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl cursor-pointer h-10.5"
                >
                  Add Item
                </button>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Requested Items Registry</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>

                        <th className="py-3 px-4 text-center">Qty Requested</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {transferItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">No products added. Use product dropdown to add.</td>
                        </tr>
                      ) : (
                        transferItems.map((item, idx) => (
                          <tr key={item.productId} className="hover:bg-slate-50/20">
                            <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>

                            <td className="py-3 px-4 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantityRequested}
                                onChange={(e) => handleQtyRequestedChange(idx, Number(e.target.value))}
                                className="w-20 px-2 py-1 text-center border border-slate-200 rounded-md outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer"
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

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Remarks / Special Notes</label>
                <textarea
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  rows={2}
                  placeholder="E.g., Stock urgently needed for weekend sale..."
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
                  disabled={createTransferMutation.isPending || transferItems.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {createTransferMutation.isPending ? 'Requesting...' : 'Request Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH GIN MODAL */}
      {isDispatchModalOpen && selectedTransfer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Goods Issue Note (GIN) Dispatch</h3>
                <p className="text-slate-500 text-xs mt-0.5">{selectedTransfer.transferNumber} - From: {selectedTransfer.sourceWarehouse.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsDispatchModalOpen(false);
                  setSelectedTransfer(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-6 space-y-6 flex-1">
              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Dispatch Checklist</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>

                        <th className="py-3 px-4 text-center">Qty Requested</th>
                        <th className="py-3 px-4 text-center">Qty Dispatched</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedTransfer.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/20">
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.product.name}</td>

                          <td className="py-3 px-4 text-center font-bold text-slate-500">{item.quantityRequested}</td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.quantityRequested}
                              value={dispatchItems[idx]?.quantityDispatched || 0}
                              onChange={(e) => handleQtyDispatchedChange(idx, Number(e.target.value))}
                              className="w-24 px-2 py-1 text-center border border-slate-200 rounded-md outline-none focus:border-purple-500 font-bold text-purple-700"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsDispatchModalOpen(false);
                    setSelectedTransfer(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatchTransferMutation.isPending}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {dispatchTransferMutation.isPending ? 'Dispatching...' : 'Dispatch Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE & RECONCILE MODAL */}
      {isReceiveModalOpen && selectedTransfer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Goods Receipt & Reconciliation</h3>
                <p className="text-slate-500 text-xs mt-0.5">{selectedTransfer.transferNumber} - Destination: {selectedTransfer.destinationWarehouse.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsReceiveModalOpen(false);
                  setSelectedTransfer(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="p-6 space-y-6 flex-1">
              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Verify & Log Variances</h4>
                <div className="border border-slate-100 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4 w-1/3">Product Name</th>
                        <th className="py-3 px-4 text-center w-24">Dispatched</th>
                        <th className="py-3 px-4 text-center w-24">Received (Good)</th>
                        <th className="py-3 px-4 text-center w-24">Damaged</th>
                        <th className="py-3 px-4 text-center w-24">Lost</th>
                        <th className="py-3 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedTransfer.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/20">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {item.product.name}

                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-600">{item.quantityDispatched}</td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.quantityDispatched}
                              value={receiveItems[idx]?.quantityReceived || 0}
                              onChange={(e) => handleReceiveItemChange(idx, 'quantityReceived', e.target.value)}
                              className="w-16 px-1.5 py-1 text-center border border-slate-200 rounded-md focus:border-emerald-500 font-bold text-emerald-600"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.quantityDispatched}
                              value={receiveItems[idx]?.quantityDamaged || 0}
                              onChange={(e) => handleReceiveItemChange(idx, 'quantityDamaged', e.target.value)}
                              className="w-16 px-1.5 py-1 text-center border border-slate-200 rounded-md focus:border-rose-500 font-bold text-rose-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.quantityDispatched}
                              value={receiveItems[idx]?.quantityLost || 0}
                              onChange={(e) => handleReceiveItemChange(idx, 'quantityLost', e.target.value)}
                              className="w-16 px-1.5 py-1 text-center border border-slate-200 rounded-md focus:border-amber-500 font-bold text-amber-600"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder="Reason for damage/loss..."
                              value={receiveItems[idx]?.remarks || ''}
                              onChange={(e) => handleReceiveItemChange(idx, 'remarks', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded-md focus:border-emerald-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiveModalOpen(false);
                    setSelectedTransfer(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receiveTransferMutation.isPending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {receiveTransferMutation.isPending ? 'Receiving...' : 'Complete Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER DETAILS VIEW MODAL */}
      {isDetailsModalOpen && selectedTransfer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedTransfer.transferNumber}</h3>
                <p className="text-slate-500 text-xs mt-0.5">Route: {selectedTransfer.sourceWarehouse.name} &rarr; {selectedTransfer.destinationWarehouse.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedTransfer(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-sm text-slate-700">
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Created By</span>
                  <span className="font-semibold text-slate-800">{selectedTransfer.createdBy.username}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Approved By</span>
                  <span className="font-semibold text-slate-800">{selectedTransfer.approvedBy?.username || 'Pending'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Dispatched By</span>
                  <span className="font-semibold text-slate-800">{selectedTransfer.dispatchedBy?.username || 'Pending'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Received By</span>
                  <span className="font-semibold text-slate-800">{selectedTransfer.receivedBy?.username || 'Pending'}</span>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Items Status Registry</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4 text-center">Requested</th>
                        <th className="py-3 px-4 text-center">Dispatched</th>
                        <th className="py-3 px-4 text-center">Received</th>
                        <th className="py-3 px-4 text-center">Damaged</th>
                        <th className="py-3 px-4 text-center">Lost</th>
                        <th className="py-3 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedTransfer.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.product.name}</td>
                          <td className="py-3 px-4 text-center">{item.quantityRequested}</td>
                          <td className="py-3 px-4 text-center font-bold text-purple-600">{item.quantityDispatched}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-600">{item.quantityReceived}</td>
                          <td className="py-3 px-4 text-center font-bold text-rose-600">{item.quantityDamaged}</td>
                          <td className="py-3 px-4 text-center font-bold text-amber-600">{item.quantityLost}</td>
                          <td className="py-3 px-4 text-slate-500">{item.remarks || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedTransfer.remarks && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Remarks</h4>
                  <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedTransfer.remarks}
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
export default StockTransfers;
