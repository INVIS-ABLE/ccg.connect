import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '@/api/client';
import { Input } from '@/components/ui/input';
import { attendanceSummary } from '@/domain/commercial/attendance';

const STATUSES = ['present', 'late', 'absent', 'no_show'];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Stat = ({ label, value, tone }) => (
  <div className={`rounded-md border px-3 py-2 text-center ${tone ?? ''}`}>
    <p className="text-lg font-bold tabular-nums">{value}</p>
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
  </div>
);

/** Daily roll-call for a deployment: set each worker present/late/absent and flag
 *  replacements. Upserts per worker per day. */
export function DeploymentRollCall({ deploymentId, members }) {
  const [date, setDate] = useState(today);
  const [byWorker, setByWorker] = useState({});

  const load = useCallback(async () => {
    const r = await api.deployments.attendance.list(deploymentId, date).catch(() => ({ attendance: [] }));
    const map = {};
    for (const rec of r.attendance ?? []) map[rec.worker_id] = rec;
    setByWorker(map);
  }, [deploymentId, date]);
  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(workerId, status) {
    const prev = byWorker[workerId] ?? {};
    setByWorker((m) => ({ ...m, [workerId]: { ...prev, worker_id: workerId, status } }));
    const r = await api.deployments.attendance.set(deploymentId, { worker_id: workerId, date, status, replacement_needed: prev.replacement_needed ?? false });
    setByWorker((m) => ({ ...m, [workerId]: r.record }));
  }
  async function toggleReplacement(workerId, needed) {
    const prev = byWorker[workerId] ?? { status: 'absent' };
    const r = await api.deployments.attendance.set(deploymentId, { worker_id: workerId, date, status: prev.status ?? 'absent', replacement_needed: needed });
    setByWorker((m) => ({ ...m, [workerId]: r.record }));
  }

  const expectedIds = useMemo(() => members.map((m) => m.worker_id), [members]);
  const summary = useMemo(
    () => attendanceSummary(Object.values(byWorker).map((r) => ({ worker_id: r.worker_id, status: r.status, replacement_needed: r.replacement_needed })), expectedIds),
    [byWorker, expectedIds],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="rc-date" className="text-sm font-medium">Date</label>
        <Input id="rc-date" type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Present" value={summary.present} tone="border-green-300 dark:border-green-900" />
        <Stat label="Late" value={summary.late} tone="border-amber-300 dark:border-amber-900" />
        <Stat label="Absent" value={summary.absent + summary.noShow} tone="border-red-300 dark:border-red-900" />
        <Stat label="Unrecorded" value={summary.unrecorded} />
        <Stat label="Replace" value={summary.replacementNeeded} tone="border-red-300 dark:border-red-900" />
        <Stat label="Fill rate" value={`${Math.round(summary.fillRate * 100)}%`} />
      </div>

      <div className="space-y-2">
        {members.length === 0 && <p className="text-xs text-muted-foreground">No workers on this deployment.</p>}
        {members.map((m) => {
          const rec = byWorker[m.worker_id];
          return (
            <div key={m.worker_id} className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{m.worker?.full_name ?? 'Worker'}</span>
              <div className="flex gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(m.worker_id, s)}
                    className={`rounded-md border px-2 py-1 text-xs capitalize ${
                      rec?.status === s
                        ? s === 'present' ? 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                        : s === 'late' ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        : 'border-input hover:bg-muted'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={!!rec?.replacement_needed} onChange={(e) => toggleReplacement(m.worker_id, e.target.checked)} />
                needs replacement
              </label>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Roll-call is authoritative — GPS check-in assists but never overrides a confirmed status.</p>
    </div>
  );
}
