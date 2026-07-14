import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api.js';
import { 
  Search, 
  Clock, 
  Package, 
  FileText, 
  Users, 
  Building, 
  ShoppingCart, 
  Archive, 
  ShieldAlert, 
  Calendar,
  Layers
} from 'lucide-react';

interface ProductResult {
  id: string;
  name: string;

  barcode: string;
  sellingPrice: number;
}

interface InvoiceResult {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  customer: { name: string } | null;
}

interface CustomerResult {
  id: string;
  name: string;
  phone: string;
  outstandingBalance: number;
}

interface SupplierResult {
  id: string;
  name: string;
  companyName: string;
  outstandingBalance: number;
}

interface POResult {
  id: string;
  poNumber: string;
  status: string;
  supplier: { name: string };
}

interface GRNResult {
  id: string;
  grnNumber: string;
  status: string;
  supplier: { name: string };
}

interface SearchResults {
  products: ProductResult[];
  invoices: InvoiceResult[];
  customers: CustomerResult[];
  suppliers: SupplierResult[];
  purchaseOrders: POResult[];
  goodsReceipts: GRNResult[];
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'SECURITY_AUDIT' | 'INVENTORY_MOVEMENT' | 'PROCUREMENT_EVENT';
  title: string;
  description: string;
  user: string;
  meta: Record<string, unknown> | null;
}

export const UniversalSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineCategory, setTimelineCategory] = useState<'ALL' | 'INVENTORY' | 'SECURITY' | 'PROCUREMENT'>('ALL');

  // Query for Universal Search
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<SearchResults>({
    queryKey: ['universal-search', searchQuery],
    queryFn: async () => {
      const res = await api.get('/search', { params: { q: searchQuery } });
      return res.data.data;
    },
    enabled: searchQuery.trim().length >= 2,
  });

  // Query for Event Timeline
  const { data: timelineEvents, isLoading: isTimelineLoading } = useQuery<TimelineEvent[]>({
    queryKey: ['event-timeline', timelineCategory],
    queryFn: async () => {
      const res = await api.get('/search/timeline', { params: { category: timelineCategory } });
      return res.data.data;
    },
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'SECURITY_AUDIT':
        return <ShieldAlert className="h-4 w-4 text-rose-600" />;
      case 'INVENTORY_MOVEMENT':
        return <Layers className="h-4 w-4 text-blue-600" />;
      case 'PROCUREMENT_EVENT':
      default:
        return <ShoppingCart className="h-4 w-4 text-amber-600" />;
    }
  };

  const getEventBg = (type: string) => {
    switch (type) {
      case 'SECURITY_AUDIT':
        return 'bg-rose-50 border-rose-100';
      case 'INVENTORY_MOVEMENT':
        return 'bg-blue-50 border-blue-100';
      case 'PROCUREMENT_EVENT':
      default:
        return 'bg-amber-50 border-amber-100';
    }
  };

  const hasResults = searchResults && (
    searchResults.products.length > 0 ||
    searchResults.invoices.length > 0 ||
    searchResults.customers.length > 0 ||
    searchResults.suppliers.length > 0 ||
    searchResults.purchaseOrders.length > 0 ||
    searchResults.goodsReceipts.length > 0
  );

  return (
    <div className="space-y-8">
      {/* Search Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Search className="h-5 w-5 text-brand-blue-600" />
          Universal Search Engine
        </h1>
        <div className="relative">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by name/barcode, invoices, customers, suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 focus:border-brand-blue-500 focus:ring-2 focus:ring-brand-blue-500/20 rounded-2xl text-sm outline-none font-semibold shadow-sm transition-all"
          />
        </div>
      </div>

      {/* SEARCH RESULTS */}
      {searchQuery.trim().length >= 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Search Results for "{searchQuery}"</h2>

          {isSearchLoading ? (
            <div className="text-center py-6 text-slate-400 text-xs">Searching...</div>
          ) : !hasResults ? (
            <div className="text-center py-6 text-slate-400 text-xs font-semibold">No matches found across catalog, invoices, or profiles.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Products */}
              {searchResults.products.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Products ({searchResults.products.length})
                  </h3>
                  <div className="space-y-2">
                    {searchResults.products.map(p => (
                      <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                        <div>
                          <span className="block font-bold text-slate-800">{p.name}</span>

                        </div>
                        <span className="font-bold text-slate-900">₹{p.sellingPrice.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices */}
              {searchResults.invoices.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Invoices ({searchResults.invoices.length})
                  </h3>
                  <div className="space-y-2">
                    {searchResults.invoices.map(inv => (
                      <div key={inv.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                        <div>
                          <span className="block font-bold text-slate-800">#{inv.invoiceNumber}</span>
                          <span className="text-[10px] text-slate-400">Cust: {inv.customer?.name || 'Walk-in'}</span>
                        </div>
                        <span className="font-bold text-slate-900">₹{inv.grandTotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers */}
              {searchResults.customers.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Customers ({searchResults.customers.length})
                  </h3>
                  <div className="space-y-2">
                    {searchResults.customers.map(c => (
                      <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                        <div>
                          <span className="block font-bold text-slate-800">{c.name}</span>
                          <span className="text-[10px] text-slate-400">Phone: {c.phone}</span>
                        </div>
                        <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          ${c.outstandingBalance.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suppliers */}
              {searchResults.suppliers.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Building className="h-3.5 w-3.5" /> Suppliers ({searchResults.suppliers.length})
                  </h3>
                  <div className="space-y-2">
                    {searchResults.suppliers.map(s => (
                      <div key={s.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                        <div>
                          <span className="block font-bold text-slate-800">{s.companyName}</span>
                          <span className="text-[10px] text-slate-400">Contact: {s.name}</span>
                        </div>
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          ${s.outstandingBalance.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Purchase Orders */}
              {searchResults.purchaseOrders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                    <ShoppingCart className="h-3.5 w-3.5" /> Purchase Orders ({searchResults.purchaseOrders.length})
                  </h3>
                  <div className="space-y-2">
                    {searchResults.purchaseOrders.map(po => (
                      <div key={po.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                        <div>
                          <span className="block font-bold text-slate-800">#{po.poNumber}</span>
                          <span className="text-[10px] text-slate-400">Supplier: {po.supplier.name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                          {po.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goods Receipts */}
              {searchResults.goodsReceipts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Archive className="h-3.5 w-3.5" /> Goods Receipts ({searchResults.goodsReceipts.length})
                  </h3>
                  <div className="space-y-2">
                    {searchResults.goodsReceipts.map(grn => (
                      <div key={grn.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                        <div>
                          <span className="block font-bold text-slate-800">#{grn.grnNumber}</span>
                          <span className="text-[10px] text-slate-400">Supplier: {grn.supplier.name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {grn.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EVENT EXPLORER TIMELINE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Clock className="h-4.5 w-4.5 text-brand-blue-600" />
            Chronological Event Explorer
          </h2>
          {/* Category Filters */}
          <div className="flex gap-1.5 flex-wrap">
            {(['ALL', 'INVENTORY', 'SECURITY', 'PROCUREMENT'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setTimelineCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border cursor-pointer ${
                  timelineCategory === cat
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat === 'ALL' ? 'All Events' : cat}
              </button>
            ))}
          </div>
        </div>

        {isTimelineLoading ? (
          <div className="text-center py-12 text-slate-400 text-xs">Loading event timeline...</div>
        ) : timelineEvents && timelineEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium">No events logged in the selected category.</div>
        ) : timelineEvents && (
          <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-6">
            {timelineEvents.map(event => (
              <div key={event.id} className="relative group">
                {/* Dot */}
                <div className={`absolute -left-[35px] top-1 w-6 h-6 rounded-full border flex items-center justify-center shadow-sm z-10 ${getEventBg(event.type)}`}>
                  {getEventIcon(event.type)}
                </div>

                {/* Event Card */}
                <div className="p-4 bg-slate-50/65 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-2xl transition-all space-y-2">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-xs font-extrabold text-slate-800">{event.title}</h3>
                    <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="h-3 w-3" />
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{event.description}</p>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold pt-1">
                    <span>Initiated by: <span className="text-slate-600 font-bold">{event.user}</span></span>
                    {event.meta && (
                      <span className="text-[9px] text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-md font-mono">
                        {JSON.stringify(event.meta)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default UniversalSearch;
