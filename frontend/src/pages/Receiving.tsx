import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api.js';
import { 
  Archive, 
  ClipboardCheck, 
  Plus, 
  Eye, 
  X, 
  Barcode, 
  Search, 
  Loader2,
  Calendar
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
}

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

interface PurchaseOrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  receivedQuantity: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier: Supplier;
  warehouseId: string;
  warehouse: Warehouse;
  items: PurchaseOrderItem[];
  status: string;
}

interface GoodsReceiptItem {
  id: string;
  productId: string;
  product: Product;
  quantityOrdered: number;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected: number;
  status: 'PASSED' | 'FAILED' | 'QUARANTINE' | 'DAMAGED' | 'EXPIRED';
  binCode: string | null;
  remarks: string | null;
}

interface GoodsReceipt {
  id: string;
  grnNumber: string;
  purchaseOrderId: string | null;
  purchaseOrder: {
    poNumber: string;
  } | null;
  supplierId: string;
  supplier: Supplier;
  warehouseId: string;
  warehouse: Warehouse;
  status: 'DRAFT' | 'PENDING_INSPECTION' | 'COMPLETED' | 'REJECTED';
  receivedById: string;
  receivedBy: {
    username: string;
  };
  inspectedById: string | null;
  inspectedBy: {
    username: string;
  } | null;
  remarks: string | null;
  items: GoodsReceiptItem[];
  createdAt: string;
}

interface GRNsResponse {
  data: GoodsReceipt[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface NewReceiptItem {
  productId: string;
  name: string;

  quantityOrdered: number;
  quantityReceived: number;
}

interface InspectedItemInput {
  itemId: string;
  quantityAccepted: number;
  quantityRejected: number;
  status: 'PASSED' | 'FAILED' | 'QUARANTINE' | 'DAMAGED' | 'EXPIRED';
  binCode: string;
  remarks: string;
}

export const Receiving: React.FC = () => {
  const queryClient = useQueryClient();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'queue' | 'logs'>('queue');
  
  // Search & Filter states
  const [grnSearch, setGrnSearch] = useState('');
  const [grnPage, setGrnPage] = useState(1);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<GoodsReceipt | null>(null);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // New GRN Wizard states
  const [selectedPOId, setSelectedPOId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [grnRemarks, setGrnRemarks] = useState('');
  const [receiptItems, setReceiptItems] = useState<NewReceiptItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Fetch GRNs (Queue: DRAFT & PENDING_INSPECTION, Logs: COMPLETED & REJECTED)
  const { data: grnsData, isLoading: isGrnsLoading } = useQuery<GRNsResponse>({
    queryKey: ['goods-receipts', grnSearch, activeTab, grnPage],
    queryFn: async () => {
      const statusFilter = activeTab === 'queue' ? 'DRAFT,PENDING_INSPECTION' : 'COMPLETED,REJECTED';
      const res = await api.get('/receiving/grns', {
        params: {
          page: grnPage,
          limit: 8,
          search: grnSearch || undefined,
          status: statusFilter,
        },
      });
      return res.data;
    },
  });

  // Fetch Approved POs for dropdown
  const { data: approvedPOsData } = useQuery<PurchaseOrder[]>({
    queryKey: ['receiving-approved-pos'],
    queryFn: async () => {
      const res = await api.get('/procurement/pos', { params: { limit: 100, status: 'APPROVED' } });
      return res.data.data;
    },
  });

  // Fetch Suppliers (for manual receipts)
  const { data: suppliersData } = useQuery<Supplier[]>({
    queryKey: ['receiving-suppliers'],
    queryFn: async () => {
      const res = await api.get('/master/suppliers', { params: { limit: 100 } });
      return res.data.data;
    },
  });

  // Fetch Warehouses
  const { data: warehousesData } = useQuery<Warehouse[]>({
    queryKey: ['receiving-warehouses'],
    queryFn: async () => {
      const res = await api.get('/inventory/warehouses');
      return res.data.data;
    },
  });

  // Fetch Products (for manual barcode scan or manual receiving)
  const { data: productsData } = useQuery<Product[]>({
    queryKey: ['receiving-products'],
    queryFn: async () => {
      const res = await api.get('/master/products', { params: { limit: 100 } });
      return res.data.data;
    },
  });

  // Load PO details when selected in wizard
  const handlePOSelect = async (poId: string) => {
    setSelectedPOId(poId);
    if (!poId) {
      setReceiptItems([]);
      setSelectedSupplierId('');
      setSelectedWarehouseId('');
      return;
    }

    const res = await api.get(`/procurement/pos/${poId}`);
    const po: PurchaseOrder = res.data.data;
    
    setSelectedSupplierId(po.supplierId);
    setSelectedWarehouseId(po.warehouseId);

    // Map PO items to receipt items
    const items: NewReceiptItem[] = po.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,

      quantityOrdered: item.quantity - item.receivedQuantity,
      quantityReceived: item.quantity - item.receivedQuantity, // Default to remaining quantity
    }));
    setReceiptItems(items);
  };

  // Barcode Scanning Simulation
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput || !productsData) return;

    const matchedProduct = productsData.find((p) => p.barcode === barcodeInput);
    if (!matchedProduct) {
      alert('Product not found in catalog');
      setBarcodeInput('');
      return;
    }

    // Check if product is already in receipt items
    const existingIndex = receiptItems.findIndex((item) => item.productId === matchedProduct.id);
    if (existingIndex > -1) {
      const updated = [...receiptItems];
      updated[existingIndex].quantityReceived += 1;
      setReceiptItems(updated);
    } else {
      setReceiptItems([
        ...receiptItems,
        {
          productId: matchedProduct.id,
          name: matchedProduct.name,

          quantityOrdered: 0, // Manual receipt
          quantityReceived: 1,
        },
      ]);
    }

    setBarcodeInput('');
  };

  const handleQtyReceivedChange = (index: number, val: number) => {
    const updated = [...receiptItems];
    updated[index].quantityReceived = val;
    setReceiptItems(updated);
  };

  const handleRemoveReceiptItem = (index: number) => {
    setReceiptItems(receiptItems.filter((_, i) => i !== index));
  };

  // Mutation to Create GRN
  const createGRNMutation = useMutation({
    mutationFn: async (grnData: { purchaseOrderId?: string | null; supplierId: string; warehouseId: string; remarks?: string; items: NewReceiptItem[]; }) => {
      const res = await api.post('/receiving/grns', grnData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
  });

  const resetCreateForm = () => {
    setSelectedPOId('');
    setSelectedSupplierId('');
    setSelectedWarehouseId('');
    setGrnRemarks('');
    setReceiptItems([]);
    setBarcodeInput('');
  };

  const handleCreateGRNSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !selectedWarehouseId || receiptItems.length === 0) return;

    createGRNMutation.mutate({
      purchaseOrderId: selectedPOId || null,
      supplierId: selectedSupplierId,
      warehouseId: selectedWarehouseId,
      remarks: grnRemarks,
      items: receiptItems,
    });
  };

  // Inspection states
  const [inspectedItems, setInspectedItems] = useState<InspectedItemInput[]>([]);
  const [inspectionRemarks, setInspectionRemarks] = useState('');

  const openInspectModal = async (grn: GoodsReceipt) => {
    setSelectedGRN(grn);
    
    // Fetch fresh details of the GRN
    const res = await api.get(`/receiving/grns/${grn.id}`);
    const detailedGRN: GoodsReceipt = res.data.data;
    setSelectedGRN(detailedGRN);

    // Initialize inspected items state
    const inputs: InspectedItemInput[] = detailedGRN.items.map((item) => ({
      itemId: item.id,
      quantityAccepted: item.quantityReceived, // Default accepted = received
      quantityRejected: 0,
      status: 'PASSED',
      binCode: item.binCode || '',
      remarks: item.remarks || '',
    }));
    setInspectedItems(inputs);
    setInspectionRemarks(detailedGRN.remarks || '');
    setIsInspectModalOpen(true);
  };

  const handleInspectedItemChange = (index: number, field: keyof InspectedItemInput, val: string | number) => {
    const updated = [...inspectedItems];
    
    if (field === 'quantityAccepted') {
      const num = Number(val);
      updated[index].quantityAccepted = num;
      // Automatically adjust rejected quantity
      const totalReceived = selectedGRN?.items[index].quantityReceived || 0;
      updated[index].quantityRejected = Math.max(0, totalReceived - num);
    } else if (field === 'quantityRejected') {
      const num = Number(val);
      updated[index].quantityRejected = num;
      // Automatically adjust accepted quantity
      const totalReceived = selectedGRN?.items[index].quantityReceived || 0;
      updated[index].quantityAccepted = Math.max(0, totalReceived - num);
    } else if (field === 'status') {
      updated[index].status = val as 'PASSED' | 'FAILED' | 'QUARANTINE' | 'DAMAGED' | 'EXPIRED';
    } else if (field === 'binCode') {
      updated[index].binCode = val as string;
    } else if (field === 'remarks') {
      updated[index].remarks = val as string;
    }

    setInspectedItems(updated);
  };

  // Mutation to save inspection
  const inspectGRNMutation = useMutation({
    mutationFn: async (data: { grnId: string; remarks: string; items: InspectedItemInput[]; }) => {
      const res = await api.post(`/receiving/grns/${data.grnId}/inspect`, {
        remarks: data.remarks,
        items: data.items,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      setIsInspectModalOpen(false);
      setSelectedGRN(null);
    },
  });

  // Mutation to complete GRN
  const completeGRNMutation = useMutation({
    mutationFn: async (grnId: string) => {
      const res = await api.post(`/receiving/grns/${grnId}/complete`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      setIsInspectModalOpen(false);
      setSelectedGRN(null);
    },
  });

  const handleInspectSubmit = (e: React.FormEvent, completeImmediately: boolean) => {
    e.preventDefault();
    if (!selectedGRN) return;

    inspectGRNMutation.mutate({
      grnId: selectedGRN.id,
      remarks: inspectionRemarks,
      items: inspectedItems,
    }, {
      onSuccess: () => {
        if (completeImmediately) {
          completeGRNMutation.mutate(selectedGRN.id);
        }
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'PENDING_INSPECTION': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REJECTED': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'PASSED': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'FAILED': return 'text-rose-600 bg-rose-50 border-rose-200';
      case 'QUARANTINE': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'DAMAGED': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'EXPIRED': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Archive className="h-6 w-6 text-emerald-600" />
            Goods Receiving Workstation
          </h1>
          <p className="text-slate-500 text-sm mt-1">Receive, inspect, and route supplier deliveries to warehouse bins</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              resetCreateForm();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Goods Receipt
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('queue');
            setGrnPage(1);
          }}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'queue'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Active Receiving Queue
        </button>
        <button
          onClick={() => {
            setActiveTab('logs');
            setGrnPage(1);
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

      {/* GRN Table Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search GRN number or supplier..."
              value={grnSearch}
              onChange={(e) => {
                setGrnSearch(e.target.value);
                setGrnPage(1);
              }}
              className="pl-9 pr-4 py-2 w-full border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                <th className="py-4 px-6">GRN Number</th>
                <th className="py-4 px-6">Linked PO</th>
                <th className="py-4 px-6">Supplier</th>
                <th className="py-4 px-6">Warehouse</th>
                <th className="py-4 px-6 text-center">Items Count</th>
                <th className="py-4 px-6">Received By</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isGrnsLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading goods receipts...</td>
                </tr>
              ) : grnsData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No goods receipts found.</td>
                </tr>
              ) : (
                grnsData?.data?.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">{grn.grnNumber}</td>
                    <td className="py-4 px-6 text-slate-500">{grn.purchaseOrder?.poNumber || 'None (Manual)'}</td>
                    <td className="py-4 px-6">{grn.supplier.name}</td>
                    <td className="py-4 px-6">{grn.warehouse.name}</td>
                    <td className="py-4 px-6 text-center">{grn.items?.length || 0}</td>
                    <td className="py-4 px-6 flex items-center gap-1.5 text-slate-600">
                      <Calendar className="h-3.5 w-3.5" />
                      {grn.receivedBy.username}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(grn.status)}`}>
                        {grn.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex justify-center gap-2">
                        {activeTab === 'queue' ? (
                          <button
                            onClick={() => openInspectModal(grn)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition-all cursor-pointer border border-emerald-100"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Inspect & Route
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const res = await api.get(`/receiving/grns/${grn.id}`);
                              setSelectedGRN(res.data.data);
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
        {grnsData?.pagination && (
          <div className="p-5 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
            <p>Showing Page {grnPage} of {grnsData.pagination.totalPages || 1}</p>
            <div className="flex gap-2">
              <button
                disabled={grnPage === 1}
                onClick={() => setGrnPage(p => p - 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={grnPage === grnsData.pagination.totalPages}
                onClick={() => setGrnPage(p => p + 1)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE GRN MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Archive className="h-5 w-5 text-emerald-600" />
                New Goods Receipt Note (GRN)
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGRNSubmit} className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Link Approved PO</label>
                  <select
                    value={selectedPOId}
                    onChange={(e) => handlePOSelect(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  >
                    <option value="">Manual Receipt (No PO)</option>
                    {approvedPOsData?.map((po) => (
                      <option key={po.id} value={po.id}>{po.poNumber} ({po.supplier.name})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Supplier</label>
                  <select
                    required
                    disabled={!!selectedPOId}
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliersData?.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Warehouse Destination</label>
                  <select
                    required
                    disabled={!!selectedPOId}
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">Select Warehouse</option>
                    {warehousesData?.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Barcode Scanner Simulator */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Barcode className="h-4 w-4 text-slate-500" />
                  Scan Barcode (Receipt Registry)
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Scan product barcode..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="px-4 py-2 flex-1 bg-white border border-slate-200 focus:border-emerald-500 rounded-lg text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBarcodeSubmit}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    Add / Increment
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Received Items Registry</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product</th>

                        <th className="py-3 px-4 text-center">Qty Ordered</th>
                        <th className="py-3 px-4 text-center">Qty Received</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {receiptItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">No products added. Scan barcodes or select a PO.</td>
                        </tr>
                      ) : (
                        receiptItems.map((item, idx) => (
                          <tr key={item.productId} className="hover:bg-slate-50/20">
                            <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>

                            <td className="py-3 px-4 text-center font-bold text-slate-500">{item.quantityOrdered}</td>
                            <td className="py-3 px-4 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantityReceived}
                                onChange={(e) => handleQtyReceivedChange(idx, Number(e.target.value))}
                                className="w-20 px-2 py-1 text-center border border-slate-200 rounded-md outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveReceiptItem(idx)}
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Receiving Remarks / Notes</label>
                <textarea
                  value={grnRemarks}
                  onChange={(e) => setGrnRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  rows={2}
                  placeholder="Note any visible damage to delivery boxes or shipping discrepancies..."
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
                  disabled={createGRNMutation.isPending || receiptItems.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {createGRNMutation.isPending ? 'Creating...' : 'Create Goods Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECTION WORKSTATION MODAL */}
      {isInspectModalOpen && selectedGRN && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delivery Quality Inspection</h3>
                <p className="text-slate-500 text-xs mt-0.5">{selectedGRN.grnNumber} - Supplier: {selectedGRN.supplier.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsInspectModalOpen(false);
                  setSelectedGRN(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleInspectSubmit(e, false)} className="p-6 space-y-6 flex-1">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Received By</span>
                  <span className="font-semibold text-slate-800">{selectedGRN.receivedBy.username}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Warehouse</span>
                  <span className="font-semibold text-slate-800">{selectedGRN.warehouse.name}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Linked PO</span>
                  <span className="font-semibold text-slate-800">{selectedGRN.purchaseOrder?.poNumber || 'Manual'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(selectedGRN.status)}`}>
                    {selectedGRN.status}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Quality Checklist & Routing</h4>
                <div className="border border-slate-100 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4 w-1/4">Product Name</th>
                        <th className="py-3 px-4 text-center w-24">Received</th>
                        <th className="py-3 px-4 text-center w-24">Accepted</th>
                        <th className="py-3 px-4 text-center w-24">Rejected</th>
                        <th className="py-3 px-4 w-36">Quality Status</th>
                        <th className="py-3 px-4 w-32">Target Bin</th>
                        <th className="py-3 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedGRN.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/20">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {item.product.name}

                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">{item.quantityReceived}</td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.quantityReceived}
                              value={inspectedItems[idx]?.quantityAccepted || 0}
                              onChange={(e) => handleInspectedItemChange(idx, 'quantityAccepted', e.target.value)}
                              className="w-16 px-1.5 py-1 text-center border border-slate-200 rounded-md focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.quantityReceived}
                              value={inspectedItems[idx]?.quantityRejected || 0}
                              onChange={(e) => handleInspectedItemChange(idx, 'quantityRejected', e.target.value)}
                              className="w-16 px-1.5 py-1 text-center border border-slate-200 rounded-md focus:border-rose-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={inspectedItems[idx]?.status || 'PASSED'}
                              onChange={(e) => handleInspectedItemChange(idx, 'status', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md focus:border-emerald-500"
                            >
                              <option value="PASSED">Passed (Sellable)</option>
                              <option value="FAILED">Failed / Discard</option>
                              <option value="QUARANTINE">Quarantine / Check</option>
                              <option value="DAMAGED">Damaged / Defect</option>
                              <option value="EXPIRED">Expired on Arrival</option>
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder="e.g. AISLE-2"
                              disabled={inspectedItems[idx]?.status !== 'PASSED'}
                              value={inspectedItems[idx]?.binCode || ''}
                              onChange={(e) => handleInspectedItemChange(idx, 'binCode', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded-md focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder="Reason for rejection..."
                              value={inspectedItems[idx]?.remarks || ''}
                              onChange={(e) => handleInspectedItemChange(idx, 'remarks', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded-md focus:border-emerald-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Inspection Remarks</label>
                <textarea
                  value={inspectionRemarks}
                  onChange={(e) => setInspectionRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm outline-none"
                  rows={2}
                  placeholder="Add details regarding overall delivery condition, box counts, seal statuses, etc."
                />
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-6">
                <div>
                  {completeGRNMutation.isPending && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                      Synchronizing warehouse stock...
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInspectModalOpen(false);
                      setSelectedGRN(null);
                    }}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    disabled={inspectGRNMutation.isPending}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Save Draft Inspection
                  </button>

                  <button
                    type="button"
                    disabled={inspectGRNMutation.isPending || completeGRNMutation.isPending}
                    onClick={(e) => handleInspectSubmit(e, true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Complete & Update Stock
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRN DETAILS VIEW MODAL */}
      {isDetailsModalOpen && selectedGRN && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedGRN.grnNumber}</h3>
                <p className="text-slate-500 text-xs mt-0.5">Supplier: {selectedGRN.supplier.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedGRN(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* Info Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Received By</span>
                  <span className="font-semibold text-slate-800">{selectedGRN.receivedBy.username}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Inspected By</span>
                  <span className="font-semibold text-slate-800">{selectedGRN.inspectedBy?.username || 'None'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Warehouse</span>
                  <span className="font-semibold text-slate-800">{selectedGRN.warehouse.name}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Linked PO</span>
                  <span className="font-semibold text-slate-800">{selectedGRN.purchaseOrder?.poNumber || 'Manual'}</span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Received Items</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-4 text-center">Ordered</th>
                        <th className="py-3 px-4 text-center">Received</th>
                        <th className="py-3 px-4 text-center">Accepted</th>
                        <th className="py-3 px-4 text-center">Rejected</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Bin Code</th>
                        <th className="py-3 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedGRN.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.product.name}</td>
                          <td className="py-3 px-4 text-center">{item.quantityOrdered}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">{item.quantityReceived}</td>
                          <td className="py-3 px-4 text-center text-emerald-600 font-bold">{item.quantityAccepted}</td>
                          <td className="py-3 px-4 text-center text-rose-600 font-bold">{item.quantityRejected}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getItemStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold">{item.binCode || '-'}</td>
                          <td className="py-3 px-4 text-slate-500">{item.remarks || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedGRN.remarks && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Remarks</h4>
                  <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedGRN.remarks}
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
export default Receiving;
