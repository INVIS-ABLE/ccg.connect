import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Package, Plus, Trash2 } from 'lucide-react';
import { MATERIAL_CATEGORIES } from '@/domain/commercial/materials';

const gbp = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
const CAT_LABEL = (c) => c.replace('_', ' ');

const NUM_FIELDS = [
  ['planned_qty', 'Planned'], ['issued_qty', 'Issued'], ['used_qty', 'Used'], ['returned_qty', 'Returned'], ['lost_qty', 'Lost/damaged'],
];
const emptyForm = { name: '', category: 'material', unit: '', supplier: '', delivery_ref: '', supplier_cost: '', client_charge: '', chargeable: true, planned_qty: '', issued_qty: '', used_qty: '', returned_qty: '', lost_qty: '' };

/**
 * Materials / plant / consumables used on a deployment — quantity lifecycle
 * (planned → issued → used → returned/lost) plus supplier cost vs client charge.
 * Cost/charge/margin are internal (ops only).
 */
export function MaterialsPanel({ deploymentId }) {
  const [rows, setRows] = useState(null);
  const [rollup, setRollup] = useState(null);
  const [editing, setEditing] = useState(null); // material row, or 'new', or null

  const load = useCallback(async () => {
    const r = await api.materials.list(deploymentId).catch(() => ({ materials: [], rollup: null }));
    setRows(r.materials ?? []);
    setRollup(r.rollup ?? null);
  }, [deploymentId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Package size={15} /> Materials &amp; plant</CardTitle>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing('new')}><Plus size={14} /> Add</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows === null && <p className="text-xs text-muted-foreground">Loading…</p>}
        {rows && rows.length === 0 && <p className="text-xs text-muted-foreground">No materials recorded.</p>}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Item</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Issued / used</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Cost</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Charge</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Margin</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/50" onClick={() => setEditing(m)}>
                    <td className="py-1.5 pr-2">
                      {m.name}
                      <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">{CAT_LABEL(m.category)}</span>
                      {!m.chargeable && <span className="ml-1 text-[10px] text-muted-foreground">· not charged</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                      {m.issued_qty ?? '—'}{m.unit ? ` ${m.unit}` : ''} / {m.totals.billableQty}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{gbp(m.totals.cost)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{gbp(m.totals.charge)}</td>
                    <td className={`py-1.5 pr-2 text-right tabular-nums ${m.totals.margin < 0 ? 'text-red-600' : 'text-green-600'}`}>{gbp(m.totals.margin)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">›</td>
                  </tr>
                ))}
              </tbody>
              {rollup && (
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="py-1.5 pr-2">Total ({rollup.count})</td>
                    <td />
                    <td className="py-1.5 pr-2 text-right tabular-nums">{gbp(rollup.cost)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{gbp(rollup.charge)}</td>
                    <td className={`py-1.5 pr-2 text-right tabular-nums ${rollup.margin < 0 ? 'text-red-600' : 'text-green-600'}`}>{gbp(rollup.margin)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
            <p className="mt-2 text-[11px] text-muted-foreground">Cost, charge and margin are internal — the client sees only their chargeable lines.</p>
          </div>
        )}
      </CardContent>

      {editing && (
        <MaterialDialog
          deploymentId={deploymentId}
          material={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </Card>
  );
}

function MaterialDialog({ deploymentId, material, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    material
      ? {
          name: material.name ?? '', category: material.category ?? 'material', unit: material.unit ?? '',
          supplier: material.supplier ?? '', delivery_ref: material.delivery_ref ?? '',
          supplier_cost: material.supplier_cost ?? '', client_charge: material.client_charge ?? '', chargeable: material.chargeable !== false,
          planned_qty: material.planned_qty ?? '', issued_qty: material.issued_qty ?? '', used_qty: material.used_qty ?? '',
          returned_qty: material.returned_qty ?? '', lost_qty: material.lost_qty ?? '',
        }
      : { ...emptyForm },
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const payload = { ...form, name: form.name.trim() };
      // Blank strings → omit so the API leaves them null.
      Object.keys(payload).forEach((k) => { if (payload[k] === '') delete payload[k]; });
      if (material) await api.materials.update(material.id, payload);
      else await api.materials.create({ deployment_id: deploymentId, ...payload });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!material) return;
    setBusy(true);
    try {
      await api.materials.remove(material.id);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{material ? 'Edit item' : 'Add material / plant'}</DialogTitle>
          <DialogDescription>Track quantities and the cost vs client charge.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Item</Label><Input value={form.name} onChange={set('name')} placeholder="Type 1 sand, excavator, orange PPE…" /></div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm capitalize" value={form.category} onChange={set('category')}>
              {MATERIAL_CATEGORIES.map((cat) => <option key={cat} value={cat}>{CAT_LABEL(cat)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Unit</Label><Input value={form.unit} onChange={set('unit')} placeholder="each / m / tonne / day" /></div>
          {NUM_FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1.5"><Label className="text-xs">{label} qty</Label><Input type="number" step="any" value={form[k]} onChange={set(k)} /></div>
          ))}
          <div className="space-y-1.5"><Label className="text-xs">Supplier cost (£/unit)</Label><Input type="number" step="any" value={form.supplier_cost} onChange={set('supplier_cost')} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Client charge (£/unit)</Label><Input type="number" step="any" value={form.client_charge} onChange={set('client_charge')} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Supplier</Label><Input value={form.supplier} onChange={set('supplier')} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Delivery ref</Label><Input value={form.delivery_ref} onChange={set('delivery_ref')} /></div>
          <label className="flex items-center gap-2 sm:col-span-2 text-sm">
            <input type="checkbox" checked={form.chargeable} onChange={(e) => setForm({ ...form, chargeable: e.target.checked })} />
            Chargeable to client
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={busy || !form.name.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
          {material && (
            <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-destructive" disabled={busy} onClick={remove}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
