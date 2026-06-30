import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PoundSterling, Plus, Archive } from 'lucide-react';

const UNITS = ['hour', 'day', 'shift'];
const EMPTY = { trade: '', role: '', unit: 'hour', pay_rate: '', charge_rate: '', overtime_rate: '' };
const gbp = (n) => (n == null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n));

/**
 * Agreed rate-card lines for a corporate account (per trade/role). Pay vs charge
 * is sensitive (margin) and never shown in the client portal. Lines are archived,
 * not deleted (retention). Used to prefill labour-request rates later.
 */
export function RateCardsSection({ accountId }) {
  const [rows, setRows] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.commercial.rateCards.list(accountId).catch(() => ({ rate_cards: [] }));
    setRows(r.rate_cards ?? []);
  }, [accountId]);
  useEffect(() => { void load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    if (!form.trade.trim()) return;
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await api.commercial.rateCards.create({ account_id: accountId, ...payload, trade: form.trade.trim() });
      setForm(EMPTY);
      setCreating(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function archive(id) {
    await api.commercial.rateCards.update(id, { status: 'archived' });
    await load();
  }

  const active = rows?.filter((r) => r.status === 'active') ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><PoundSterling size={15} /> Rate cards</CardTitle>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreating((v) => !v)}><Plus size={14} /> Add rate</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {creating && (
          <form onSubmit={add} className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className="text-xs">Trade</Label><Input required value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} placeholder="Groundworker" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Role (optional)</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ganger / SSSTS" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm capitalize" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2 sm:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-xs">Pay rate</Label><Input type="number" step="any" value={form.pay_rate} onChange={(e) => setForm({ ...form, pay_rate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Charge rate</Label><Input type="number" step="any" value={form.charge_rate} onChange={(e) => setForm({ ...form, charge_rate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Overtime</Label><Input type="number" step="any" value={form.overtime_rate} onChange={(e) => setForm({ ...form, overtime_rate: e.target.value })} /></div>
            </div>
            <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Add rate card'}</Button></div>
          </form>
        )}

        {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rows && active.length === 0 && <p className="text-sm text-muted-foreground">No rate cards yet.</p>}

        {active.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Trade / role</th>
                  <th className="py-1.5 pr-2 font-medium">Unit</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Pay</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Charge</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Margin</th>
                  <th className="py-1.5 pr-2 text-right font-medium">OT</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {active.map((r) => {
                  const margin = r.pay_rate != null && r.charge_rate != null ? r.charge_rate - r.pay_rate : null;
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">{r.trade}{r.role ? <span className="text-muted-foreground"> · {r.role}</span> : ''}</td>
                      <td className="py-1.5 pr-2 capitalize text-muted-foreground">/{r.unit}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{gbp(r.pay_rate)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{gbp(r.charge_rate)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-green-600">{gbp(margin)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{gbp(r.overtime_rate)}</td>
                      <td className="py-1.5 text-right">
                        <button onClick={() => archive(r.id)} className="text-muted-foreground hover:text-foreground" aria-label="Archive rate card" title="Archive">
                          <Archive size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted-foreground">Pay, charge and margin are internal — never shown to the client.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
