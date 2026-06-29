import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, FileText, Search, ShieldCheck, AlertTriangle } from 'lucide-react';

function statusBadge(status) {
  if (status === 'verified') return <Badge className="bg-green-100 text-green-700 border-0">Verified</Badge>;
  if (status === 'rejected') return <Badge className="bg-red-100 text-red-700 border-0">Rejected</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-0">Awaiting</Badge>;
}

export default function ComplianceDashboard() {
  const [creds, setCreds] = useState(null);
  const [types, setTypes] = useState([]);
  const [filter, setFilter] = useState('awaiting'); // awaiting | verified | rejected | all
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState(null);

  async function load() {
    try {
      const [c, t] = await Promise.all([api.credentials.awaiting(), api.credentials.types()]);
      setCreds(c.credentials);
      setTypes(t.credentialTypes);
    } catch {
      setError('Could not load credentials.');
    }
  }

  useEffect(() => { void load(); }, []);

  const typeName = (id) => types.find((t) => t.id === id)?.name ?? id;

  async function approve(id) {
    setBusy(id);
    try {
      await api.credentials.update(id, { verification_status: 'verified' });
      setCreds((prev) => prev.map((c) => c.id === id ? { ...c, verification_status: 'verified' } : c));
    } catch { setError('Could not approve.'); }
    finally { setBusy(null); }
  }

  async function reject(id) {
    if (!rejectReason.trim()) return;
    setBusy(id);
    try {
      await api.credentials.update(id, { verification_status: 'rejected', rejection_reason: rejectReason });
      setCreds((prev) => prev.map((c) => c.id === id ? { ...c, verification_status: 'rejected', rejection_reason: rejectReason } : c));
      setRejectTarget(null);
      setRejectReason('');
    } catch { setError('Could not reject.'); }
    finally { setBusy(null); }
  }

  const allCreds = creds ?? [];
  const filtered = allCreds
    .filter((c) => filter === 'all' || (filter === 'awaiting' ? !c.verification_status || c.verification_status === 'pending' : c.verification_status === filter))
    .filter((c) => !search || typeName(c.credential_type_id).toLowerCase().includes(search.toLowerCase()) || (c.issuer ?? '').toLowerCase().includes(search.toLowerCase()));

  const awaitingCount = allCreds.filter((c) => !c.verification_status || c.verification_status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" /> Document Compliance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Review and approve contractor credentials and documents.</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Awaiting review', count: awaitingCount, color: 'text-amber-500', key: 'awaiting' },
          { label: 'Verified', count: allCreds.filter((c) => c.verification_status === 'verified').length, color: 'text-green-600', key: 'verified' },
          { label: 'Rejected', count: allCreds.filter((c) => c.verification_status === 'rejected').length, color: 'text-red-500', key: 'rejected' },
        ].map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`text-left rounded-xl border p-4 transition-colors ${filter === s.key ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/40'}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{creds === null ? '…' : s.count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-base">
              {filter === 'awaiting' ? 'Awaiting review' : filter === 'verified' ? 'Verified documents' : filter === 'rejected' ? 'Rejected documents' : 'All documents'}
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-52">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFilter('all')} className={filter === 'all' ? 'text-primary' : ''}>All</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          {creds === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {creds !== null && filtered.length === 0 && (
            <div className="py-10 text-center">
              <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">Nothing to review here.</p>
            </div>
          )}

          <ul className="divide-y">
            {filtered.map((cr) => (
              <li key={cr.id} className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{typeName(cr.credential_type_id)}</span>
                      {statusBadge(cr.verification_status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cr.issuer ?? '—'}
                      {cr.registration_or_policy_number ? ` · Ref: ${cr.registration_or_policy_number}` : ''}
                      {cr.expiry_date ? ` · Expires: ${cr.expiry_date}` : ''}
                    </p>
                    {cr.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle size={11} /> {cr.rejection_reason}
                      </p>
                    )}

                    {/* Inline reject form */}
                    {rejectTarget === cr.id && (
                      <div className="mt-3 flex items-center gap-2">
                        <Input
                          className="h-8 text-sm flex-1"
                          placeholder="Reason for rejection…"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          autoFocus
                        />
                        <Button size="sm" variant="destructive" disabled={busy === cr.id || !rejectReason.trim()} onClick={() => reject(cr.id)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Action buttons — only show for awaiting */}
                  {(!cr.verification_status || cr.verification_status === 'pending') && rejectTarget !== cr.id && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" disabled={busy === cr.id} onClick={() => approve(cr.id)}
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle size={13} /> Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === cr.id}
                        className="flex items-center gap-1 border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => { setRejectTarget(cr.id); setRejectReason(''); }}>
                        <XCircle size={13} /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}