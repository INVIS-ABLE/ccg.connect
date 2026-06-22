import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const STATUS_VARIANT = {
  approved: 'default',
  pending: 'secondary',
  suspended: 'destructive',
  rejected: 'destructive',
  archived: 'outline',
};

export default function Contractors() {
  const [contractors, setContractors] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    try {
      const r = await api.contractors.list();
      setContractors(r.contractors);
    } catch {
      setError('Could not load contractors.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id, approval_status) {
    setBusy(id);
    try {
      await api.contractors.update(id, { approval_status });
      await load();
    } catch {
      setError('Could not update contractor.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Contractors</h1>
      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && contractors === null && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {!error && contractors?.length === 0 && (
            <p className="text-sm text-muted-foreground">No contractors yet.</p>
          )}
          {!error && contractors && contractors.length > 0 && (
            <ul className="divide-y">
              {contractors.map((ct) => (
                <li key={ct.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {ct.trading_name ?? ct.legal_name ?? 'Unnamed contractor'}
                      </span>
                      <Badge variant={STATUS_VARIANT[ct.approval_status] ?? 'secondary'}>
                        {ct.approval_status}
                      </Badge>
                      {ct.preferred_contractor && <Badge variant="outline">Preferred</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {ct.primary_trade ?? '—'}
                      {ct.base_postcode ? ` · ${ct.base_postcode}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ct.approval_status !== 'approved' && (
                      <Button size="sm" disabled={busy === ct.id} onClick={() => setStatus(ct.id, 'approved')}>
                        Approve
                      </Button>
                    )}
                    {ct.approval_status !== 'suspended' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === ct.id}
                        onClick={() => setStatus(ct.id, 'suspended')}
                      >
                        Suspend
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
