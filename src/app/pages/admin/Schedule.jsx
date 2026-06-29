import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarDays } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import Gantt from 'frappe-gantt';
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
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('calendar');
  const ganttRef = useRef(null);

  useEffect(() => {
    api.jobs
      .list()
      .then((r) => setJobs(r.jobs ?? []))
      .catch(() => setError('Could not load jobs.'));
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
      </Tabs>
    </div>
  );
}
