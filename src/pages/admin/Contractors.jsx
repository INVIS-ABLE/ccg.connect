import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { APPROVAL_STATUSES } from '@/lib/roles';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'suspended', 'rejected'];

export default function Contractors() {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    base44.entities.ContractorProfile.filter({ archived: false }).then(data => {
      setContractors(data);
      setLoading(false);
    });
  }, []);

  const filtered = contractors.filter(c => {
    const matchSearch = !search ||
      c.trading_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.legal_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.primary_trade?.toLowerCase().includes(search.toLowerCase()) ||
      c.base_postcode?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.approval_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Contractors"
        subtitle={`${contractors.length} registered`}
        actions={
          <Link to="/contractors/new">
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Add Contractor</Button>
          </Link>
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search contractors..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {s === 'all' ? 'All' : APPROVAL_STATUSES[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              <p>No contractors found</p>
              <Link to="/contractors/new"><Button variant="outline" size="sm" className="mt-3">Add first contractor</Button></Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(c => {
                const s = APPROVAL_STATUSES[c.approval_status];
                return (
                  <Link key={c.id} to={`/contractors/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <HardHat className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.trading_name || c.legal_name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{c.primary_trade || 'Trade not set'} • {c.base_postcode || 'No postcode'}</p>
                    </div>
                    {s && <StatusBadge label={s.label} color={s.color} />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}