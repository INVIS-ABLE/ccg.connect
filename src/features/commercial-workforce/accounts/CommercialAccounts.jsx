import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, ChevronRight } from 'lucide-react';

const STATUS_COLOR = {
  active: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  prospect: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  inactive: 'bg-muted text-muted-foreground',
};

/** Corporate accounts list + create. The top of the commercial hierarchy
 *  (account → project → site → … ). Admin-only (route-guarded). */
export default function CommercialAccounts() {
  const [accounts, setAccounts] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ legal_name: '', registration_number: '', payment_terms: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const r = await api.commercial.accounts.list();
      setAccounts(r.accounts);
    } catch {
      setError('Could not load accounts.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!form.legal_name.trim()) return;
    setSaving(true);
    try {
      await api.commercial.accounts.create({
        legal_name: form.legal_name.trim(),
        registration_number: form.registration_number.trim() || undefined,
        payment_terms: form.payment_terms.trim() || undefined,
      });
      setForm({ legal_name: '', registration_number: '', payment_terms: '' });
      setCreating(false);
      await load();
    } catch {
      setError('Could not create account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="text-primary" size={22} /> Corporate accounts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Enterprise clients — each with its own projects, sites, rates and contacts.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreating((v) => !v)}>
          <Plus size={16} /> New account
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {creating && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New corporate account</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="ln">Legal company name</Label>
                <Input id="ln" required value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rn">Company reg. number</Label>
                <Input id="rn" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt">Payment terms</Label>
                <Input id="pt" placeholder="e.g. 30 days" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {accounts === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {accounts?.length === 0 && <p className="text-sm text-muted-foreground">No corporate accounts yet.</p>}

      <div className="grid gap-3">
        {accounts?.map((a) => (
          <Link key={a.id} to={`/commercial/accounts/${a.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 py-4">
                <Building2 size={18} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.legal_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.registration_number ? `Reg ${a.registration_number}` : 'No reg. number'}
                    {a.payment_terms ? ` · ${a.payment_terms}` : ''}
                  </p>
                </div>
                <Badge className={`${STATUS_COLOR[a.status] ?? ''} capitalize`} variant="secondary">{a.status}</Badge>
                <ChevronRight size={16} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
