import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STATUS_VARIANT = {
  verified: 'default',
  awaiting_review: 'secondary',
  rejected: 'destructive',
  expired: 'destructive',
  superseded: 'outline',
};

export default function ContractorCredentials() {
  const [creds, setCreds] = useState(null);
  const [types, setTypes] = useState([]);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ credential_type_id: '', issuer: '', registration_or_policy_number: '', issue_date: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [c, t] = await Promise.all([api.credentials.list(), api.credentials.types()]);
      setCreds(c.credentials);
      setTypes(t.credentialTypes);
    } catch {
      setError('Could not load credentials.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const typeName = (id) => types.find((t) => t.id === id)?.name ?? id;

  async function add(e) {
    e.preventDefault();
    if (!form.credential_type_id) return;
    setSaving(true);
    try {
      await api.credentials.create(form);
      setForm({ credential_type_id: '', issuer: '', registration_or_policy_number: '', issue_date: '', expiry_date: '' });
      setOpen(false);
      await load();
    } catch {
      setError('Could not add credential.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Credentials</h1>
        <Button onClick={() => setOpen((v) => !v)}>{open ? 'Cancel' : 'Add credential'}</Button>
      </div>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Add credential</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.credential_type_id}
                  onChange={(e) => setForm({ ...form, credential_type_id: e.target.value })}
                >
                  <option value="">Select…</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuer">Issuer</Label>
                <Input id="issuer" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num">Reg / policy number</Label>
                <Input id="num" value={form.registration_or_policy_number} onChange={(e) => setForm({ ...form, registration_or_policy_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue">Issue date</Label>
                <Input id="issue" type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry date</Label>
                <Input id="expiry" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Add'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && creds === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!error && creds?.length === 0 && (
            <p className="text-sm text-muted-foreground">No credentials added yet.</p>
          )}
          {!error && creds && creds.length > 0 && (
            <ul className="divide-y">
              {creds.map((cr) => (
                <li key={cr.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{typeName(cr.credential_type_id)}</span>
                      <Badge variant={STATUS_VARIANT[cr.verification_status] ?? 'secondary'}>
                        {cr.verification_status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {cr.issuer ?? '—'}
                      {cr.expiry_date ? ` · expires ${cr.expiry_date}` : ''}
                    </div>
                    {cr.rejection_reason && (
                      <div className="text-xs text-destructive">Rejected: {cr.rejection_reason}</div>
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
