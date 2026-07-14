import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  Search, 
  Download, 
  CalendarRange, 
  Loader2, 
  X,
  Filter,
  Eye,
  Terminal
} from 'lucide-react';
import api from '../services/api.ts';

// --- Type Definitions ---
interface AuditLog {
  id: string;
  userId: string | null;
  user: { username: string; role: string } | null;
  eventType: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  correlationId: string;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const Audit: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // --- Queries ---
  const { data: auditData, isLoading: isLogsLoading } = useQuery({
    queryKey: ['audit-logs', page, search, selectedType, startDate, endDate],
    queryFn: async () => {
      const res = await api.get('/audit/logs', {
        params: { 
          page, 
          limit: 12, 
          search: search || undefined,
          eventType: selectedType || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        }
      });
      return res.data.data as AuditLogsResponse;
    }
  });

  const { data: typesData } = useQuery({
    queryKey: ['audit-types'],
    queryFn: async () => {
      const res = await api.get('/audit/types');
      return res.data.data.eventTypes as string[];
    }
  });

  const selectedLog = auditData?.logs.find((l) => l.id === selectedLogId);

  // --- CSV Exporter ---
  const handleExportCSV = () => {
    if (!auditData || auditData.logs.length === 0) return;

    const headers = ['Timestamp', 'User', 'Role', 'Event Type', 'Description', 'IP Address', 'Correlation ID'];
    const rows = auditData.logs.map((l) => [
      new Date(l.createdAt).toLocaleString(),
      l.user?.username || 'System',
      l.user?.role || 'SYSTEM',
      l.eventType,
      l.description,
      l.ipAddress || '-',
      l.correlationId
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `family_mart_audit_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-6">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-brand-blue-600" size={22} />
            <span>System Audit & Activity Terminal</span>
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Track user actions, configuration modifications, and system transactions.</p>
        </div>
        <button 
          onClick={handleExportCSV}
          disabled={!auditData || auditData.logs.length === 0}
          className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50"
        >
          <Download size={16} />
          <span>Export Filtered CSV</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Free Text Search</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search description, IP, correlation ID..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
            />
          </div>
        </div>

        {/* Event Type */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <Filter size={10} />
            <span>Filter Event Type</span>
          </label>
          <select
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
            className="form-input text-xs py-2"
          >
            <option value="">All Event Types</option>
            {typesData?.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <CalendarRange size={10} />
            <span>Start Date</span>
          </label>
          <input 
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="form-input text-xs py-1.5"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <CalendarRange size={10} />
            <span>End Date</span>
          </label>
          <input 
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="form-input text-xs py-1.5"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card overflow-hidden">
        {isLogsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-brand-blue-600" size={32} />
          </div>
        ) : !auditData || auditData.logs.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm">No audit logs found matching criteria.</div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">User Details</th>
                    <th className="px-6 py-4">Event Type</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">IP / Connection</th>
                    <th className="px-6 py-4 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditData.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                      <td className="px-6 py-4 text-slate-400 text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{log.user?.username || 'System'}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-medium">{log.user?.role || 'SYSTEM'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                          {log.eventType}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800 max-w-sm truncate">
                        {log.description}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                        <div>{log.ipAddress || '-'}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 select-all">CID: {log.correlationId}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedLogId(log.id)}
                          className="p-1.5 hover:bg-brand-blue-50 text-slate-400 hover:text-brand-blue-600 rounded-lg transition-colors"
                          title="Inspect Metadata"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Page {page} of {auditData.pagination.totalPages || 1}
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-medium rounded-lg transition-colors"
                >
                  Previous
                </button>
                <button 
                  disabled={page === auditData.pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-medium rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLogId && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Terminal className="text-brand-blue-600" size={20} />
                <h3 className="text-base font-display font-bold text-slate-800">Metadata Inspection</h3>
              </div>
              <button 
                onClick={() => setSelectedLogId(null)} 
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl">
                <div>
                  <div className="font-semibold text-slate-400 uppercase text-[9px]">Event Type</div>
                  <div className="text-slate-800 font-bold mt-0.5">{selectedLog.eventType}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-400 uppercase text-[9px]">Cashier / Actor</div>
                  <div className="text-slate-800 font-semibold mt-0.5">{selectedLog.user?.username || 'System'} ({selectedLog.user?.role || 'SYSTEM'})</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-400 uppercase text-[9px]">Correlation ID</div>
                  <div className="text-slate-800 font-mono mt-0.5 select-all">{selectedLog.correlationId}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-400 uppercase text-[9px]">IP Address</div>
                  <div className="text-slate-800 font-mono mt-0.5">{selectedLog.ipAddress || '-'}</div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-400 uppercase text-[9px] mb-1">Description</div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-800">
                  {selectedLog.description}
                </div>
              </div>

              {/* Metadata JSON diff */}
              {selectedLog.metadata && (
                <div>
                  <div className="font-semibold text-slate-400 uppercase text-[9px] mb-1.5">Entity Modifications & Payloads</div>
                  <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto font-mono text-[10px] leading-relaxed max-h-60 overflow-y-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button 
                onClick={() => setSelectedLogId(null)} 
                className="btn-secondary px-5 py-2.5 text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Audit;
