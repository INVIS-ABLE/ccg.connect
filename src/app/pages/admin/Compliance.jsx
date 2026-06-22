import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Admin review queue for contractor credentials awaiting verification. */
export default function Compliance() {
  const [creds, setCreds] = useState(null);
  const [types, setTypes] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    try {
      const [c, t] = await Promise.all([api.credentials.awaiting(), api.credentials.types()]);
      setCreds(c.credentials);
      setTypes(t.credentialTypes);
    } catch {
      setError('Could not load the review queue.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const typeName = (id) => types.find((t) => t.id === id)?.name ?? id;

  async function decide(id, verification_status) {
    let rejection_reason;
    if (verification_status === 'rejected') {
      rejection_reason = window.prompt('Reason for rejection?') ?? '';
    }
    setBusy(id);
    try {
      await api.credentials.update(id, { verification_status, rejection_reason });
      await load();
    } catch {
      setError('Could not update credential.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Compliance — credential review</h1>
      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && creds === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!error && creds?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing awaiting review. 🎉</p>
          )}
          {!error && creds && creds.length > 0 && (
            <ul className="divide-y">
              {creds.map((cr) => (
                <li key={cr.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="font-medium">{typeName(cr.credential_type_id)}</div>
                    <div className="text-sm text-muted-foreground">
                      {cr.issuer ?? '—'}
                      {cr.registration_or_policy_number ? ` · ${cr.registration_or_policy_number}` : ''}
                      {cr.expiry_date ? ` · expires ${cr.expiry_date}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === cr.id} onClick={() => decide(cr.id, 'verified')}>
                      Verify
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === cr.id} onClick={() => decide(cr.id, 'rejected')}>
                      Reject
                    </Button>
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
