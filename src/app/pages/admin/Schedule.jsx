import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarDays, Users, AlertTriangle } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import Gantt from 'frappe-gantt';
import { findConflictingBookingIds } from '@/domain/scheduling/conflicts';
// Vendored from frappe-gantt/dist (its package "exports" map blocks importing the
// CSS by subpath). Keep in sync if the dep is upgraded.
import '@/styles/frappe-gantt.css';

const URGENCY_COLOR = {
  emergency: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#64748b',
};

function dayAfter(iso) {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Scheduling: a job calendar (FullCalendar) and a project timeline (Frappe
 *  Gantt), both driven by the jobs the admin can see. Lazy-loaded in App.jsx so
 *  these heavier libraries stay out of the main bundle. */
export default function Schedule() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('calendar');
  const ganttRef = useRef(null);

  useEffect(() => {
    api.jobs
      .list()
      .then((r) => setJobs(r.jobs ?? []))
      .catch(() => setError('Could not load jobs.'));
    // Team view inputs (best-effort — the calendar/timeline still work without).
    api.contractors.list().then((r) => setContractors(r.contractors ?? [])).catch(() => {});
    api.assignments.list().then((r) => setAssignments(r.assignments ?? [])).catch(() => {});
  }, []);

  const scheduled = useMemo(() => jobs.filter((j) => j.start_date), [jobs]);

  const events = useMemo(
    () =>
      scheduled.map((j) => ({
        id: j.id,
        title: j.title,
        start: j.start_date.slice(0, 10),
        end: j.end_date ? dayAfter(j.end_date.slice(0, 10)) : dayAfter(j.start_date.slice(0, 10)),
        allDay: true,
        backgroundColor: URGENCY_COLOR[j.urgency] ?? '#f97316',
        borderColor: URGENCY_COLOR[j.urgency] ?? '#f97316',
      })),
    [scheduled],
  );

  const tasks = useMemo(
    () =>
      scheduled.map((j) => {
        const start = j.start_date.slice(0, 10);
        let end = (j.end_date ?? j.start_date).slice(0, 10);
        if (end < start) end = start;
        const progress = j.status === 'completed' ? 100 : j.status === 'in_progress' ? 50 : 0;
        return { id: j.id, name: j.title, start, end, progress };
      }),
    [scheduled],
  );

  // ── Team / resource view ──
  const jobTitleById = useMemo(() => new Map(jobs.map((j) => [j.id, j.title])), [jobs]);

  // One booking per active assignment that has a planned start.
  const bookings = useMemo(
    () =>
      assignments
        .filter((a) => a.assignment_status === 'active' && a.planned_start)
        .map((a) => {
          const start = a.planned_start.slice(0, 10);
          let finish = (a.planned_finish ?? a.planned_start).slice(0, 10);
          if (finish < start) finish = start;
          return { id: a.id, contractor_id: a.contractor_id, start, finish, job_id: a.job_id };
        }),
    [assignments],
  );

  const conflictIds = useMemo(() => findConflictingBookingIds(bookings), [bookings]);

  // Contractors that have bookings, each with their (date-sorted) bookings.
  const teamRows = useMemo(() => {
    const byContractor = new Map();
    for (const b of bookings) {
      const list = byContractor.get(b.contractor_id) ?? [];
      list.push(b);
      byContractor.set(b.contractor_id, list);
    }
    return [...byContractor.entries()]
      .map(([contractorId, list]) => {
        const c = contractors.find((x) => x.id === contractorId);
        const name = c?.trading_name || c?.legal_name || 'Contractor';
        const hasConflict = list.some((b) => conflictIds.has(b.id));
        return {
          contractorId,
          name,
          hasConflict,
          bookings: [...list].sort((a, b) => a.start.localeCompare(b.start)),
        };
      })
      .sort((a, b) => Number(b.hasConflict) - Number(a.hasConflict) || a.name.localeCompare(b.name));
  }, [bookings, contractors, conflictIds]);

  // (Re)render the Gantt when its tab is active and tasks change.
  useEffect(() => {
    if (tab !== 'timeline' || !ganttRef.current) return;
    ganttRef.current.innerHTML = '';
    if (tasks.length === 0) return;
    try {
      // eslint-disable-next-line no-new
      new Gantt(ganttRef.current, tasks, {
        view_mode: 'Week',
        readonly: true,
        on_click: (task) => navigate(`/jobs/${task.id}`),
      });
    } catch {
      /* gantt render failure is non-fatal */
    }
    return () => {
      if (ganttRef.current) ganttRef.current.innerHTML = '';
    };
  }, [tab, tasks, navigate]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CalendarDays className="text-primary" size={22} /> Schedule
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Jobs by date, and an overall project timeline.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <div className="rounded-lg border bg-card p-3 [&_.fc]:text-sm [&_.fc-toolbar-title]:text-base">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
              height="auto"
              events={events}
              eventClick={(info) => {
                info.jsEvent.preventDefault();
                navigate(`/jobs/${info.event.id}`);
              }}
            />
          </div>
          {scheduled.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">No scheduled jobs yet (jobs need a start date).</p>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <div className="overflow-x-auto rounded-lg border bg-card p-3">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled jobs yet (jobs need a start date).</p>
            ) : (
              <div ref={ganttRef} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="team" className="mt-4 space-y-3">
          {conflictIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={16} className="shrink-0" />
              {conflictIds.size} booking{conflictIds.size === 1 ? '' : 's'} double-booked — resolve the
              clashes highlighted below.
            </div>
          )}

          {teamRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active assignments with planned dates yet. Assign contractors with planned start/finish
              dates to see who&apos;s booked when.
            </p>
          ) : (
            <div className="grid gap-3">
              {teamRows.map((row) => (
                <div
                  key={row.contractorId}
                  className={`rounded-lg border bg-card p-3 ${row.hasConflict ? 'border-red-300 dark:border-red-900' : ''}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Users size={15} className="text-muted-foreground" />
                    <span className="font-medium text-sm">{row.name}</span>
                    {row.hasConflict && (
                      <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                        <AlertTriangle size={10} /> Double-booked
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {row.bookings.length} job{row.bookings.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {row.bookings.map((b) => {
                      const clash = conflictIds.has(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() => navigate(`/jobs/${b.job_id}`)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
                            clash ? 'bg-red-50 dark:bg-red-950/20' : ''
                          }`}
                        >
                          {clash && <AlertTriangle size={13} className="shrink-0 text-red-600" />}
                          <span className="min-w-0 flex-1 truncate">{jobTitleById.get(b.job_id) ?? 'Job'}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {b.start}
                            {b.finish !== b.start ? ` → ${b.finish}` : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
