import { useEffect, useState, useCallback } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { nextTimesheetStatuses, timesheetStatusLabel } from '@/domain/commercial/timesheetApproval';

const gbp = (n) => (n == null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n));

/** Weekly timesheets for a deployment, with the rate engine's pay/charge/margin.
 *  Margin is sensitive — this whole surface is admin-only. */
export function DeploymentTimesheets({ deploymentId, members }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ worker_id: '', week_start: '', basic_hours: '', overtime_hours: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.commercialTimesheets.list(deploymentId).catch(() => ({ timesheets: [] }));
    setRows(r.timesheets ?? []);
  }, [deploymentId]);
  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = (wid) => members.find((m) => m.worker_id === wid)?.worker?.full_name ?? 'Worker';

  async function create(e) {
    e.preventDefault();
    if (!form.worker_id || !form.week_start) return;
    setBusy(true);
    try {
      await api.commercialTimesheets.create({
        deployment_id: deploymentId,
        worker_id: form.worker_id,
        week_start: form.week_start,
        basic_hours: form.basic_hours ? Number(form.basic_hours) : 0,
        overtime_hours: form.overtime_hours ? Number(form.overtime_hours) : 0,
      });
      setForm({ worker_id: '', week_start: '', basic_hours: '', overtime_hours: '' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function advance(ts, status) {
    await api.commercialTimesheets.update(ts.id, { status });
    await load();
  }

  const totalMargin = rows.reduce((s, r) => s + (r.totals?.margin ?? 0), 0);

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No timesheets yet.</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Worker</th>
                <th className="px-2 py-2 font-medium">Week</th>
                <th className="px-2 py-2 text-right font-medium">Hrs</th>
                <th className="px-2 py-2 text-right font-medium">Pay</th>
                <th className="px-2 py-2 text-right font-medium">Charge</th>
                <th className="px-2 py-2 text-right font-medium">Margin</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{nameOf(r.worker_id)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.week_start}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.totals?.totalHours}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{gbp(r.totals?.workerPay)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{gbp(r.totals?.clientCharge)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium text-green-700 dark:text-green-400">{gbp(r.totals?.margin)}</td>
                  <td className="px-2 py-2"><Badge variant="secondary">{timesheetStatusLabel(r.status)}</Badge></td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {nextTimesheetStatuses(r.status).map((s) => (
                        <Button key={s} size="sm" variant={s === 'rejected' ? 'outline' : 'default'} className="h-7 px-2 text-xs" onClick={() => advance(r, s)}>
                          {timesheetStatusLabel(s)}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="py-2 pr-3" colSpan={5}>Total margin</td>
                <td className="px-2 py-2 text-right tabular-nums text-green-700 dark:text-green-400">{gbp(totalMargin)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <form onSubmit={create} className="flex flex-wrap items-end gap-2 border-t pt-3">
        <select className="h-9 min-w-40 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={form.worker_id} onChange={(e) => setForm({ ...form, worker_id: e.target.value })}>
          <option value="">Worker…</option>
          {members.map((m) => <option key={m.worker_id} value={m.worker_id}>{m.worker?.full_name ?? 'Worker'}</option>)}
        </select>
        <Input type="date" className="w-40" value={form.week_start} onChange={(e) => setForm({ ...form, week_start: e.target.value })} aria-label="Week starting" />
        <Input type="number" min="0" step="0.5" className="w-24" placeholder="Basic h" value={form.basic_hours} onChange={(e) => setForm({ ...form, basic_hours: e.target.value })} />
        <Input type="number" min="0" step="0.5" className="w-24" placeholder="OT h" value={form.overtime_hours} onChange={(e) => setForm({ ...form, overtime_hours: e.target.value })} />
        <Button type="submit" size="sm" disabled={busy || !form.worker_id || !form.week_start} className="gap-1.5"><Plus size={14} /> Add</Button>
      </form>
      <p className="text-xs text-muted-foreground">Rates are taken from the deployment; margin is visible to CCG staff only.</p>
    </div>
  );
}
