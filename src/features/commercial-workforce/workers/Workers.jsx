import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { HardHat, Plus, ChevronRight, ShieldCheck, ShieldAlert } from 'lucide-react';

const RTW_OK = (s) => s === 'checked';

export default function Workers() {
  const [workers, setWorkers] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: '', mobile: '', primary_trade: '', base_postcode: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const r = await api.workers.list();
      setWorkers(r.workers);
    } catch {
      setError('Could not load workers.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ''));
      await api.workers.create({ ...payload, full_name: form.full_name.trim() });
      setForm({ full_name: '', mobile: '', primary_trade: '', base_postcode: '' });
      setCreating(false);
      await load();
    } catch {
      setError('Could not create worker.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <HardHat className="text-primary" size={22} /> Workers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Individual operatives — each with a passport of cards, qualifications and right-to-work.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreating((v) => !v)}>
          <Plus size={16} /> New worker
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {creating && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New worker</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fn">Full name</Label>
                <Input id="fn" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2"><Label htmlFor="mob">Mobile</Label><Input id="mob" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="tr">Primary trade</Label><Input id="tr" value={form.primary_trade} onChange={(e) => setForm({ ...form, primary_trade: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="pc">Base postcode</Label><Input id="pc" value={form.base_postcode} onChange={(e) => setForm({ ...form, base_postcode: e.target.value })} /></div>
              <div className="flex items-end"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {workers === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {workers?.length === 0 && <p className="text-sm text-muted-foreground">No workers yet.</p>}

      <div className="grid gap-3">
        {workers?.map((w) => (
          <Link key={w.id} to={`/workforce/workers/${w.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 py-4">
                <HardHat size={18} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{w.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {w.primary_trade || 'Trade not set'}{w.base_postcode ? ` · ${w.base_postcode}` : ''}
                  </p>
                </div>
                {RTW_OK(w.right_to_work_status) ? (
                  <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"><ShieldCheck size={12} /> RTW</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><ShieldAlert size={12} /> RTW {w.right_to_work_status}</Badge>
                )}
                <ChevronRight size={16} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
