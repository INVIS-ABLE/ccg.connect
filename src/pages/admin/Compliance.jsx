import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, AlertTriangle, Clock, CheckCircle, XCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { CREDENTIAL_STATUSES } from '@/lib/roles';

export default function Compliance() {
  const [credentials, setCredentials] = useState([]);
  const [credentialTypes, setCredentialTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('awaiting_review');

  useEffect(() => {
    Promise.all([
      base44.entities.ContractorCredential.filter({ archived: false }),
      base44.entities.CredentialType.list(),
    ]).then(([creds, types]) => {
      setCredentials(creds);
      setCredentialTypes(types);
      setLoading(false);
    });
  }, []);

  const typeMap = Object.fromEntries(credentialTypes.map(t => [t.id, t]));

  const filtered = credentials.filter(c => {
    const type = typeMap[c.credential_type_id];
    const matchSearch = !search || type?.name?.toLowerCase().includes(search.toLowerCase()) || c.issuer?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.verification_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    awaiting_review: credentials.filter(c => c.verification_status === 'awaiting_review').length,
    verified: credentials.filter(c => c.verification_status === 'verified').length,
    expired: credentials.filter(c => c.verification_status === 'expired').length,
    rejected: credentials.filter(c => c.verification_status === 'rejected').length,
  };

  const handleVerify = async (credId) => {
    await base44.entities.ContractorCredential.update(credId, { verification_status: 'verified', verified_at: new Date().toISOString() });
    setCredentials(prev => prev.map(c => c.id === credId ? { ...c, verification_status: 'verified' } : c));
  };

  const handleReject = async (credId) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    await base44.entities.ContractorCredential.update(credId, { verification_status: 'rejected', rejection_reason: reason });
    setCredentials(prev => prev.map(c => c.id === credId ? { ...c, verification_status: 'rejected' } : c));
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="Compliance" subtitle="Credential verification and management" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { key: 'awaiting_review', label: 'Awaiting Review', icon: Clock, color: 'text-amber-600' },
          { key: 'verified', label: 'Verified', icon: CheckCircle, color: 'text-green-600' },
          { key: 'expired', label: 'Expired', icon: AlertTriangle, color: 'text-red-600' },
          { key: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-600' },
        ].map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`bg-card border rounded-xl p-4 text-left transition-all ${statusFilter === key ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-xl font-bold">{counts[key]}</p>
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search credentials..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No credentials found</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(cred => {
                const type = typeMap[cred.credential_type_id];
                const s = CREDENTIAL_STATUSES[cred.verification_status];
                return (
                  <div key={cred.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{type?.name || 'Unknown credential'}</p>
                      <p className="text-xs text-muted-foreground">
                        {cred.issuer || 'No issuer'} • {cred.expiry_date ? `Expires ${cred.expiry_date}` : 'No expiry'}
                      </p>
                    </div>
                    {s && <StatusBadge label={s.label} color={s.color} />}
                    {cred.verification_status === 'awaiting_review' && (
                      <div className="flex gap-1 ml-2">
                        <button onClick={() => handleVerify(cred.id)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded font-medium hover:bg-green-200">
                          Verify
                        </button>
                        <button onClick={() => handleReject(cred.id)} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded font-medium hover:bg-red-200">
                          Reject
                        </button>
                      </div>
                    )}
                    {cred.file_url && (
                      <a href={cred.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline ml-1">View</a>
                    )}
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