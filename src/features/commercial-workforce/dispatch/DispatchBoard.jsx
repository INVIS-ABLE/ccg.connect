import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { api } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LayoutGrid, MapPin, CalendarClock, HardHat, Plus, X, CheckCircle2, AlertTriangle, GripVertical, Users } from 'lucide-react';

// MapLibre is heavy — lazy-load at the use site so it stays out of this chunk.
const CoverageMap = lazy(() => import('@/components/map/CoverageMap'));

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

// Timeline / map colours by staffing state (need met / short / unknown).
const FILL_FULL = '#16a34a';
const FILL_SHORT = '#f59e0b';
const FILL_UNKNOWN = '#64748b';

// Worker map-pin colour by right-to-work status.
const RTW_PIN = { checked: '#16a34a', unchecked: '#64748b', expired: '#dc2626', restricted: '#f59e0b' };

const ROSTER = 'roster';

/** Monday 00:00 of the current week through the following Sunday (local time). */
function thisWeekWindow() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(monday), end: iso(nextMonday) };
}

function dayAfter(iso) {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function availabilityLabel(availableFrom) {
  if (!availableFrom) return 'Available';
  const today = new Date().toISOString().slice(0, 10);
  return availableFrom <= today ? 'Available now' : `From ${availableFrom}`;
}

export default function DispatchBoard() {
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('board');
  const [selectedDep, setSelectedDep] = useState(null);
  const [busy, setBusy] = useState(false);
  const [gangs, setGangs] = useState([]);
  const [gangPick, setGangPick] = useState('');

  const load = () =>
    api.dispatch
      .board()
      .then(setBoard)
      .catch(() => setError('Could not load the dispatch board.'));

  useEffect(() => {
    load();
    // Saved gangs power the one-click "deploy a gang" action (best-effort).
    api.gangs.list().then((r) => setGangs(r.gangs ?? [])).catch(() => {});
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

  // All live deployments (not only this week) with dates drive the timeline.
  const events = useMemo(() => {
    if (!board) return [];
    return board.deployments
      .filter((d) => d.start_date)
      .map((d) => {
        const need = d.workers_required ?? null;
        const filled = d.worker_ids.length;
        const color = need === null ? FILL_UNKNOWN : filled >= need ? FILL_FULL : FILL_SHORT;
        return {
          id: d.id,
          title: `${d.request_title ?? 'Deployment'}${need !== null ? ` (${filled}/${need})` : ''}`,
          start: d.start_date,
          end: dayAfter(d.finish_date ?? d.start_date),
          allDay: true,
          backgroundColor: color,
          borderColor: color,
        };
      });
  }, [board]);

  // Map markers: this week's sites (coloured by staffing) + the active roster
  // (coloured by right-to-work). Only geocoded records get a pin.
  const mapData = useMemo(() => {
    const markers = [];
    for (const d of weekDeps) {
      if (typeof d.site_lat !== 'number' || typeof d.site_lng !== 'number') continue;
      const need = d.workers_required ?? null;
      const filled = d.worker_ids.length;
      const color = need === null ? FILL_UNKNOWN : filled >= need ? FILL_FULL : FILL_SHORT;
      markers.push({
        id: `site-${d.id}`,
        lat: d.site_lat,
        lng: d.site_lng,
        color,
        label: `${d.site_name ?? d.request_title ?? 'Site'} — ${filled}${need !== null ? `/${need}` : ''} on site`,
      });
    }
    for (const w of board?.workers ?? []) {
      if (typeof w.latitude !== 'number' || typeof w.longitude !== 'number') continue;
      markers.push({
        id: `worker-${w.id}`,
        lat: w.latitude,
        lng: w.longitude,
        color: RTW_PIN[w.right_to_work_status] ?? RTW_PIN.unchecked,
        label: `${w.full_name} — ${w.primary_trade ?? 'trade n/a'}`,
      });
    }
    // Centre on the mean of whatever we have; fall back to the UK.
    const center = markers.length
      ? {
          lat: markers.reduce((s, m) => s + m.lat, 0) / markers.length,
          lng: markers.reduce((s, m) => s + m.lng, 0) / markers.length,
        }
      : null;
    return { markers, center };
  }, [weekDeps, board]);

  // Compliance overlay: workers whose right-to-work needs attention, and
  // deployments still short of their required headcount this week.
  const complianceAlerts = useMemo(() => {
    const rtwIssues = (board?.workers ?? []).filter((w) =>
      w.right_to_work_status === 'expired' || w.right_to_work_status === 'restricted',
    );
    const shortDeps = weekDeps.filter((d) => d.workers_required !== null && d.worker_ids.length < d.workers_required);
    return { rtwIssues, shortDeps };
  }, [board, weekDeps]);

  async function assign(depId, workerId) {
    if (busy) return;
    setBusy(true);
    try {
      await api.deployments.assignWorker(depId, workerId);
      await load();
    } catch {
      setError('Could not assign that worker.');
    } finally {
      setBusy(false);
    }
  }

  async function unassign(depId, workerId) {
    if (busy) return;
    setBusy(true);
    try {
      await api.deployments.unassignWorker(depId, workerId);
      await load();
    } catch {
      setError('Could not remove that worker.');
    } finally {
      setBusy(false);
    }
  }

  async function deployGang(depId, gangId) {
    if (!gangId || busy) return;
    setBusy(true);
    try {
      await api.deployments.assignGang(depId, gangId);
      setGangPick('');
      await load();
    } catch {
      setError('Could not deploy that gang.');
    } finally {
      setBusy(false);
    }
  }

  // Drag a worker chip from the roster onto a deployment droppable to assign.
  // The roster list is never mutated, so the chip animates back — a worker can be
  // dispatched to several deployments.
  function onDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId !== ROSTER) return;
    if (destination.droppableId === ROSTER) return;
    const dep = weekDeps.find((d) => d.id === destination.droppableId);
    if (!dep || dep.worker_ids.includes(draggableId)) return;
    assign(dep.id, draggableId);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <LayoutGrid className="text-primary" size={22} /> Dispatch
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This week&apos;s deployments and the available workforce. Drag a worker onto a deployment — or pick a deployment and tap to assign.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {board === null && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {board && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-4">
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                {/* This week's deployments — each is a drop target */}
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
                        <Droppable droppableId={d.id} key={d.id}>
                          {(dropProvided, dropSnapshot) => (
                            <Card
                              ref={dropProvided.innerRef}
                              {...dropProvided.droppableProps}
                              className={`transition-colors ${isSel ? 'border-primary ring-1 ring-primary' : 'hover:border-primary'} ${dropSnapshot.isDraggingOver ? 'border-primary bg-primary/5' : ''}`}
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
                                          <button
                                            type="button"
                                            onClick={() => unassign(d.id, wid)}
                                            disabled={busy}
                                            aria-label={`Remove ${w?.full_name ?? 'worker'} from this deployment`}
                                            className="ml-0.5 rounded-full hover:text-destructive focus-visible:outline focus-visible:outline-2"
                                          >
                                            <X size={12} />
                                          </button>
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Drop-target placeholder (kept minimal — chips render on the card above). */}
                                <div className="hidden">{dropProvided.placeholder}</div>
                              </CardContent>
                            </Card>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>
                </section>

                {/* Worker roster — draggable source list */}
                <section className="space-y-3" aria-label="Available workforce">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <HardHat size={16} /> Roster ({board.workers.length})
                  </h2>
                  {selected ? (
                    <p className="text-xs text-muted-foreground">
                      Assigning to <span className="font-medium text-foreground">{selected.request_title ?? 'deployment'}</span>. Drag a worker onto a deployment, or tap Assign.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Drag a worker onto a deployment, or select one to use the Assign buttons.</p>
                  )}
                  {board.workers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No active workers on the roster.</p>
                  )}
                  {/* Deploy a whole saved gang onto the selected deployment. */}
                  {selected && gangs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Users size={13} /> Deploy a gang
                      </span>
                      <select
                        className="h-8 min-w-40 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                        value={gangPick}
                        onChange={(e) => setGangPick(e.target.value)}
                        aria-label="Choose a saved gang to deploy"
                      >
                        <option value="">Choose a gang…</option>
                        {gangs.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <Button size="sm" disabled={busy || !gangPick} onClick={() => deployGang(selected.id, gangPick)}>
                        <Plus size={14} /> Deploy
                      </Button>
                    </div>
                  )}
                  <Droppable droppableId={ROSTER} isDropDisabled>
                    {(listProvided) => (
                      <div ref={listProvided.innerRef} {...listProvided.droppableProps} className="grid gap-2">
                        {board.workers.map((w, index) => {
                          const rtw = RTW[w.right_to_work_status] ?? RTW.unchecked;
                          const isAssigned = assignedIds.has(w.id);
                          return (
                            <Draggable draggableId={w.id} index={index} key={w.id}>
                              {(dragProvided, dragSnapshot) => (
                                <Card
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`transition-colors ${dragSnapshot.isDragging ? 'border-primary shadow-lg' : ''}`}
                                >
                                  <CardContent className="flex items-center gap-2 py-3">
                                    <span
                                      {...dragProvided.dragHandleProps}
                                      aria-label={`Drag ${w.full_name} to a deployment`}
                                      className="cursor-grab text-muted-foreground active:cursor-grabbing"
                                    >
                                      <GripVertical size={16} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <Link to={`/workforce/workers/${w.id}`} className="truncate font-medium hover:underline">
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
                                    {selected &&
                                      (isAssigned ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={busy}
                                          onClick={() => unassign(selected.id, w.id)}
                                          aria-label={`Remove ${w.full_name} from ${selected.request_title ?? 'deployment'}`}
                                        >
                                          <X size={14} /> Remove
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          disabled={busy}
                                          onClick={() => assign(selected.id, w.id)}
                                          aria-label={`Assign ${w.full_name} to ${selected.request_title ?? 'deployment'}`}
                                        >
                                          <Plus size={14} /> Assign
                                        </Button>
                                      ))}
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          );
                        })}
                        {listProvided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </section>
              </div>
            </DragDropContext>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <div className="rounded-lg border bg-card p-3 [&_.fc]:text-sm [&_.fc-toolbar-title]:text-base">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridWeek"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridWeek,dayGridMonth' }}
                height="auto"
                events={events}
                eventClick={(info) => {
                  info.jsEvent.preventDefault();
                  navigate(`/workforce/deployments/${info.event.id}`);
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: FILL_FULL }} /> Fully staffed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: FILL_SHORT }} /> Short of workers
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: FILL_UNKNOWN }} /> No target set
              </span>
            </div>
            {events.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">No dated deployments to show on the timeline yet.</p>
            )}
          </TabsContent>

          <TabsContent value="map" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <div>
                {mapData.center ? (
                  <Suspense fallback={<div className="h-[420px] rounded-lg border bg-muted/30" />}>
                    <CoverageMap
                      center={mapData.center}
                      zoom={8}
                      height={420}
                      markers={mapData.markers.map((m) => ({
                        ...m,
                        onClick: () => {
                          const [kind, id] = m.id.split(/-(.+)/);
                          navigate(kind === 'site' ? `/workforce/deployments/${id}` : `/workforce/workers/${id}`);
                        },
                      }))}
                    />
                  </Suspense>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No mapped locations yet — sites and workers appear once their postcodes are geocoded.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: FILL_SHORT }} /> Site short of workers
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: FILL_FULL }} /> Site fully staffed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: RTW_PIN.expired }} /> Worker RTW issue
                  </span>
                </div>
              </div>

              {/* Compliance overlay */}
              <aside className="space-y-3" aria-label="Compliance alerts">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <AlertTriangle size={16} /> Compliance
                </h2>
                {complianceAlerts.rtwIssues.length === 0 && complianceAlerts.shortDeps.length === 0 && (
                  <p className="text-sm text-muted-foreground">No compliance or staffing alerts this week.</p>
                )}

                {complianceAlerts.shortDeps.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Short of workers ({complianceAlerts.shortDeps.length})
                    </p>
                    {complianceAlerts.shortDeps.map((d) => (
                      <Link
                        key={d.id}
                        to={`/workforce/deployments/${d.id}`}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <MapPin size={13} className="shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{d.site_name ?? d.request_title ?? 'Deployment'}</span>
                        <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                          {d.worker_ids.length}/{d.workers_required}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                {complianceAlerts.rtwIssues.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">
                      Right-to-work ({complianceAlerts.rtwIssues.length})
                    </p>
                    {complianceAlerts.rtwIssues.map((w) => (
                      <Link
                        key={w.id}
                        to={`/workforce/workers/${w.id}`}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <HardHat size={13} className="shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{w.full_name}</span>
                        <span className="shrink-0 text-xs capitalize text-red-600 dark:text-red-400">
                          {w.right_to_work_status}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
