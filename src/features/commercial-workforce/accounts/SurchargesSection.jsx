import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Percent, Plus, Archive } from 'lucide-react';

const EMPTY = { label: '', kind: 'percent', value: '' };
const fmtValue = (s) => (s.kind === 'percent' ? `+${s.value}%` : `+£${s.value}`);

/**
 * Dynamic-pricing surcharges for a corporate account (night shift, weekend,
 * distance, urgency, short-notice, lodge…). Applied on top of a base charge rate
 * when raising a labour request. Internal — affects the client charge.
 */
export function SurchargesSection({ accountId }) {
  const [rows, setRows] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.commercial.surcharges.list(accountId).catch(() => ({ surcharges: [] }));
    setRows(r.surcharges ?? []);
  }, [accountId]);
  useEffect(() => { void load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    if (!form.label.trim()) return;
    setBusy(true);
    try {
      await api.commercial.surcharges.create({ account_id: accountId, label: form.label.trim(), kind: form.kind, value: Number(form.value) || 0 });
      setForm(EMPTY);
      setCreating(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id) {
    await api.commercial.surcharges.update(id, { active: false });
    await load();
  }

  const active = rows?.filter((r) => r.active) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Percent size={15} /> Surcharges</CardTitle>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreating((v) => !v)}><Plus size={14} /> Add</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {creating && (
          <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
            <div className="min-w-40 flex-1 space-y-1.5"><Label className="text-xs">Label</Label><Input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Night shift" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <select className="flex h-10 rounded-md border border-input bg-background px-2 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="percent">%</option>
                <option value="fixed">£/unit</option>
              </select>
            </div>
            <div className="w-24 space-y-1.5"><Label className="text-xs">Value</Label><Input type="number" step="any" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
            <Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Add'}</Button>
          </form>
        )}

        {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rows && active.length === 0 && <p className="text-sm text-muted-foreground">No surcharges yet.</p>}
        {active.map((s) => (
          <div key={s.id} className="flex items-center gap-3 border-b py-2 last:border-0 text-sm">
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums text-muted-foreground">{fmtValue(s)}</span>
            <button onClick={() => deactivate(s.id)} className="text-muted-foreground hover:text-foreground" aria-label="Deactivate surcharge" title="Deactivate">
              <Archive size={14} />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
