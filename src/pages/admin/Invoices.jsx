import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { INVOICE_STATUSES } from '@/lib/roles';

const STATUS_FILTERS = ['all', 'draft', 'submitted', 'approved', 'sent', 'paid', 'overdue'];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    base44.entities.Invoice.list('-created_date', 100).then(data => {
      setInvoices(data);
      setLoading(false);
    });
  }, []);

  const filtered = invoices.filter(inv => {
    const matchSearch = !search || inv.invoice_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalOutstanding = invoices.filter(i => ['submitted', 'approved', 'sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + (i.gross_amount || 0), 0);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="Invoices" subtitle={`${invoices.length} total invoices`} />

      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <p className="text-xs text-muted-foreground">Outstanding</p>
        <p className="text-2xl font-bold text-foreground">£{totalOutstanding.toFixed(2)}</p>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {s === 'all' ? 'All' : INVOICE_STATUSES[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No invoices found</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(inv => {
                const s = INVOICE_STATUSES[inv.status];
                return (
                  <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{inv.invoice_number || 'Draft Invoice'}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoice_type === 'ccg_to_client' ? 'CCG → Client' : 'Contractor → CCG'} • {inv.issue_date || 'No date'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">£{(inv.gross_amount || 0).toFixed(2)}</p>
                      {s && <StatusBadge label={s.label} color={s.color} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}