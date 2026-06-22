import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-800',
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    base44.entities.Client.filter({ archived: false }).then(data => {
      setClients(data);
      setLoading(false);
    });
  }, []);

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.individual_or_company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.main_contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.account_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} total clients`}
        actions={
          <Link to="/clients/new">
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Add Client</Button>
          </Link>
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search clients..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4">
        {['all', 'active', 'inactive', 'suspended'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              <p>No clients found</p>
              <Link to="/clients/new"><Button variant="outline" size="sm" className="mt-3">Add first client</Button></Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(c => (
                <Link key={c.id} to={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.individual_or_company_name}</p>
                    <p className="text-xs text-muted-foreground">{c.main_contact_name || 'No contact'} • {c.email || 'No email'}</p>
                  </div>
                  <StatusBadge label={c.account_status} color={STATUS_COLORS[c.account_status] || 'bg-gray-100 text-gray-600'} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}