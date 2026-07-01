import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LayoutGrid, MapPin, CalendarClock, HardHat, Plus, X, CheckCircle2, AlertTriangle } from 'lucide-react';

const STATUS_COLOR = {
  proposed: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
};

// Right-to-work at a glance — never conveyed by colour alone (icon + text).
const RTW = {
  checked: { label: 'RTW ✓', className: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300', Icon: CheckCircle2 },
  unchecked: { label: 'RTW unchecked', className: 'bg-muted text-muted-foreground', Icon: AlertTriangle },
  expired: { label: 'RTW expired', className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300', Icon: AlertTriangle },
  restricted: { label: 'RTW restricted', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', Icon: AlertTriangle },
};

/** Monday 00:00 of the current week through the following Sunday (local time). */
function thisWeekWindow() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(monday), end: iso(nextMonday) };
}

function availabilityLabel(availableFrom) {
  if (!availableFrom) return 'Available';
  const today = new Date().toISOString().slice(0, 10);
  return availableFrom <= today ? 'Available now' : `From ${availableFrom}`;
}

export default function DispatchBoard() {
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDep, setSelectedDep] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.dispatch
      .board()
      .then(setBoard)
      .catch(() => setError('Could not load the dispatch board.'));

  useEffect(() => {
    load();
  }, []);

  const week = useMemo(() => thisWeekWindow(), []);

  // "This week" = deployments overlapping the current week, or undated ones that
  // still need attention. Sorted list already comes from the server.
  const weekDeps = useMemo(() => {
    if (!board) return [];
    return board.deployments.filter((d) => {
      if (!d.start_date) return true;
      const start = d.start_date;
      const finish = d.finish_date ?? d.start_date;
      return start < week.end && finish >= week.start;
    });
  }, [board, week]);

  const workerById = useMemo(() => {
    const m = new Map();
    for (const w of board?.workers ?? []) m.set(w.id, w);
    return m;
  }, [board]);

  const selected = weekDeps.find((d) => d.id === selectedDep) ?? null;
  const assignedIds = new Set(selected?.worker_ids ?? []);

  async function assign(workerId) {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await api.deployments.assignWorker(selected.id, workerId);
      await load();
    } catch {
      setError('Could not assign that worker.');
    } finally {
      setBusy(false);
    }
  }

  async function unassign(workerId) {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await api.deployments.unassignWorker(selected.id, workerId);
      await load();
    } catch {
      setError('Could not remove that worker.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <LayoutGrid className="text-primary" size={22} /> Dispatch
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This week&apos;s deployments and the available workforce. Pick a deployment, then add workers from the roster.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {board === null && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {board && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* This week's deployments */}
          <section className="space-y-3" aria-label="This week's deployments">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CalendarClock size={16} /> This week ({weekDeps.length})
            </h2>
            {weekDeps.length === 0 && (
              <p className="text-sm text-muted-foreground">No deployments scheduled for this week.</p>
            )}
            <div className="grid gap-3">
              {weekDeps.map((d) => {
                const isSel = d.id === selectedDep;
                const filled = d.worker_ids.length;
                const need = d.workers_required ?? null;
                const short = need !== null && filled < need;
                return (
                  <Card
                    key={d.id}
                    className={`cursor-pointer transition-colors ${isSel ? 'border-primary ring-1 ring-primary' : 'hover:border-primary'}`}
                  >
                    <CardContent className="space-y-2 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedDep(isSel ? null : d.id)}
                        aria-pressed={isSel}
                        className="flex w-full items-start gap-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{d.request_title ?? 'Deployment'}</p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin size={12} /> {d.site_name ?? 'Site TBC'}
                            {d.site_postcode ? ` · ${d.site_postcode}` : ''}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {d.start_date ? `From ${d.start_date}` : 'Dates TBC'}
                            {d.finish_date ? ` – ${d.finish_date}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={`${STATUS_COLOR[d.status] ?? ''} capitalize`} variant="secondary">
                            {d.status}
                          </Badge>
                          <span className={`text-xs font-medium ${short ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                            {filled}
                            {need !== null ? ` / ${need}` : ''} assigned
                          </span>
                        </div>
                      </button>

                      {d.worker_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {d.worker_ids.map((wid) => {
                            const w = workerById.get(wid);
                            return (
                              <Badge key={wid} variant="outline" className="gap-1 font-normal">
                                <HardHat size={11} /> {w?.full_name ?? 'Worker'}
                                {isSel && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      unassign(wid);
                                    }}
                                    disabled={busy}
                                    aria-label={`Remove ${w?.full_name ?? 'worker'} from this deployment`}
                                    className="ml-0.5 rounded-full hover:text-destructive focus-visible:outline focus-visible:outline-2"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Worker roster */}
          <section className="space-y-3" aria-label="Available workforce">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <HardHat size={16} /> Roster ({board.workers.length})
            </h2>
            {selected ? (
              <p className="text-xs text-muted-foreground">
                Assigning to <span className="font-medium text-foreground">{selected.request_title ?? 'deployment'}</span>. Tap a worker to add.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Select a deployment on the left to assign workers.</p>
            )}
            {board.workers.length === 0 && (
              <p className="text-sm text-muted-foreground">No active workers on the roster.</p>
            )}
            <div className="grid gap-2">
              {board.workers.map((w) => {
                const rtw = RTW[w.right_to_work_status] ?? RTW.unchecked;
                const isAssigned = assignedIds.has(w.id);
                return (
                  <Card key={w.id} className="transition-colors">
                    <CardContent className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/workforce/workers/${w.id}`}
                          className="truncate font-medium hover:underline"
                        >
                          {w.full_name}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{w.primary_trade ?? 'Trade n/a'}</span>
                          {w.base_postcode && <span>· {w.base_postcode}</span>}
                          <span>· {availabilityLabel(w.available_from)}</span>
                        </p>
                        <Badge className={`mt-1 gap-1 font-normal ${rtw.className}`} variant="secondary">
                          <rtw.Icon size={11} /> {rtw.label}
                        </Badge>
                      </div>
                      {selected && (
                        isAssigned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => unassign(w.id)}
                            aria-label={`Remove ${w.full_name} from ${selected.request_title ?? 'deployment'}`}
                          >
                            <X size={14} /> Remove
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => assign(w.id)}
                            aria-label={`Assign ${w.full_name} to ${selected.request_title ?? 'deployment'}`}
                          >
                            <Plus size={14} /> Assign
                          </Button>
                        )
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
