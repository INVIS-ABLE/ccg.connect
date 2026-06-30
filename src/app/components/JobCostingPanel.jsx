import { useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save } from 'lucide-react';
import { jobCostBreakdown, parseMaterials, applyVat } from '@/domain/jobs/costing';

function gbp(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
}

/**
 * Internal job costing: domestic/commercial classification, an editable
 * materials list, labour cost, and a live total breakdown. Persists onto the job
 * (sector / materials JSON / labour_cost) via PATCH /api/jobs.
 */
export function JobCostingPanel({ job, onSaved }) {
  const [sector, setSector] = useState(job.sector ?? '');
  const [labour, setLabour] = useState(job.labour_cost ?? '');
  const [lines, setLines] = useState(() => {
    const m = parseMaterials(job.materials);
    return m.length ? m : [{ description: '', qty: 1, unit_cost: 0 }];
  });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

  const { materialsCost, labourCost, total } = jobCostBreakdown(lines, labour);
  const { vat, totalIncVat } = applyVat(total, 0.2);

  function setLine(i, patch) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, { description: '', qty: 1, unit_cost: 0 }]);
  }
  function removeLine(i) {
    setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));
  }

  async function save() {
    setSaving(true);
    setSavedMsg(null);
    try {
      // Keep only lines with a description or a value.
      const cleaned = lines.filter(
        (l) => (l.description ?? '').trim() || Number(l.qty) > 0 || Number(l.unit_cost) > 0,
      );
      const updated = await api.jobs.update(job.id, {
        sector: sector || null,
        materials: JSON.stringify(cleaned),
        labour_cost: Number(labour) || 0,
      });
      onSaved?.(updated.job);
      setSavedMsg('Saved');
    } catch {
      setSavedMsg('Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Sector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Job type</span>
        <div className="flex gap-1 rounded-md border p-0.5">
          {['domestic', 'commercial'].map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={sector === s ? 'default' : 'ghost'}
              className="h-7 px-3 text-xs capitalize"
              onClick={() => setSector(sector === s ? '' : s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Materials */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materials</p>
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="Material / description"
              value={l.description ?? ''}
              onChange={(e) => setLine(i, { description: e.target.value })}
            />
            <Input
              className="w-16"
              type="number"
              min="0"
              placeholder="Qty"
              value={l.qty ?? ''}
              onChange={(e) => setLine(i, { qty: e.target.value })}
            />
            <Input
              className="w-24"
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit £"
              value={l.unit_cost ?? ''}
              onChange={(e) => setLine(i, { unit_cost: e.target.value })}
            />
            <span className="w-20 shrink-0 text-right text-sm tabular-nums">
              {gbp((Number(l.qty) || 0) * (Number(l.unit_cost) || 0))}
            </span>
            <button
              type="button"
              onClick={() => removeLine(i)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove material line"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5">
          <Plus size={14} /> Add material
        </Button>
      </div>

      {/* Labour */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Labour cost £</span>
        <Input
          type="number"
          min="0"
          step="0.01"
          className="w-32"
          value={labour}
          onChange={(e) => setLabour(e.target.value)}
          placeholder="0.00"
        />
      </div>

      {/* Totals */}
      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Materials</span><span className="tabular-nums">{gbp(materialsCost)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Labour</span><span className="tabular-nums">{gbp(labourCost)}</span></div>
        <div className="mt-1 flex justify-between border-t pt-1"><span className="text-muted-foreground">Net total</span><span className="tabular-nums">{gbp(total)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">VAT (20%)</span><span className="tabular-nums">{gbp(vat)}</span></div>
        <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Total inc. VAT</span><span className="tabular-nums">{gbp(totalIncVat)}</span></div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving} className="gap-1.5">
          <Save size={14} /> {saving ? 'Saving…' : 'Save breakdown'}
        </Button>
        {savedMsg && <span className="text-xs text-muted-foreground">{savedMsg}</span>}
      </div>
    </div>
  );
}
