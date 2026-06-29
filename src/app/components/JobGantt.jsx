import { useMemo } from 'react';
import { Link } from 'react-router-dom';

const STATUS_COLOR = {
  draft:       'bg-gray-300',
  enquiry:     'bg-blue-400',
  quoted:      'bg-yellow-400',
  confirmed:   'bg-indigo-400',
  in_progress: 'bg-orange-400',
  completed:   'bg-green-500',
  cancelled:   'bg-red-300',
};

const STATUS_LABEL = {
  draft: 'Draft', enquiry: 'Enquiry', quoted: 'Quoted', confirmed: 'Confirmed',
  in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Visual Gantt/timeline for jobs with start+end dates */
export default function JobGantt({ jobs }) {
  const scheduledJobs = useMemo(() =>
    (jobs ?? []).filter((j) => j.start_date && j.status !== 'cancelled'),
    [jobs],
  );

  const { rangeStart, rangeEnd, days } = useMemo(() => {
    if (!scheduledJobs.length) return { rangeStart: new Date(), rangeEnd: new Date(), days: 0 };
    const starts = scheduledJobs.map((j) => startOfDay(j.start_date));
    const ends   = scheduledJobs.map((j) => j.end_date ? startOfDay(j.end_date) : addDays(j.start_date, 1));
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    // pad 2 days each side
    const rs = addDays(min, -2);
    const re = addDays(max, 2);
    const totalDays = Math.max(1, Math.round((re - rs) / 86400000));
    return { rangeStart: rs, rangeEnd: re, days: totalDays };
  }, [scheduledJobs]);

  // Generate tick marks (every 7 days, or every day if range < 14)
  const tickInterval = days <= 14 ? 1 : days <= 60 ? 7 : 14;
  const ticks = [];
  for (let i = 0; i < days; i += tickInterval) {
    ticks.push(i);
  }

  function pct(date) {
    const d = startOfDay(date);
    return Math.max(0, Math.min(100, ((d - rangeStart) / (rangeEnd - rangeStart)) * 100));
  }

  function barWidth(job) {
    const s = startOfDay(job.start_date);
    const e = job.end_date ? startOfDay(job.end_date) : addDays(job.start_date, 1);
    const w = ((e - s) / (rangeEnd - rangeStart)) * 100;
    return Math.max(w, 1.5); // minimum visible width
  }

  if (!scheduledJobs.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No jobs with scheduled dates. Add start/end dates to jobs to see the timeline.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: Math.max(600, days * 20) + 'px' }}>
        {/* Day ticks header */}
        <div className="relative h-6 border-b mb-1">
          {ticks.map((offset) => {
            const d = addDays(rangeStart, offset);
            const pctPos = (offset / days) * 100;
            return (
              <div
                key={offset}
                className="absolute text-[10px] text-muted-foreground"
                style={{ left: `${pctPos}%`, transform: 'translateX(-50%)' }}
              >
                {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </div>
            );
          })}
        </div>

        {/* Today marker */}
        {(() => {
          const todayPct = pct(new Date());
          if (todayPct < 0 || todayPct > 100) return null;
          return (
            <div
              className="absolute z-10 top-0 bottom-0 w-px bg-red-400 pointer-events-none"
              style={{ left: `${todayPct}%` }}
            />
          );
        })()}

        {/* Job rows */}
        <div className="space-y-1.5 relative">
          {/* Today line across all rows */}
          <div
            className="absolute inset-y-0 w-px bg-red-300/60 z-0 pointer-events-none"
            style={{ left: `${pct(new Date())}%` }}
          />

          {scheduledJobs.map((job) => {
            const left = pct(job.start_date);
            const width = barWidth(job);
            const color = STATUS_COLOR[job.status] ?? 'bg-gray-300';

            return (
              <div key={job.id} className="relative h-8 flex items-center">
                {/* Track */}
                <div className="absolute inset-0 rounded bg-muted/50" />
                {/* Bar */}
                <Link
                  to={`/jobs/${job.id}`}
                  className={`absolute h-6 rounded ${color} opacity-90 hover:opacity-100 transition-opacity flex items-center px-2 overflow-hidden group`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${job.title} · ${job.status}`}
                >
                  <span className="text-[11px] font-medium text-white truncate whitespace-nowrap">
                    {job.title}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
          {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'cancelled').map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`w-3 h-3 rounded ${STATUS_COLOR[key]}`} />
              {label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 border-l-2 border-red-400" />
            Today
          </div>
        </div>
      </div>
    </div>
  );
}