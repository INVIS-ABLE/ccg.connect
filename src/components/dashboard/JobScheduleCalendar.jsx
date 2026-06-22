import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Return first Monday on or before the 1st of the given month
function getGridStart(year, month) {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // 0=Mon
  const start = new Date(first);
  start.setDate(1 - dow);
  return start;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Jobs that span across a given day
function jobsForDay(jobs, date) {
  const ds = date.toISOString().split('T')[0];
  return jobs.filter(j => {
    const s = j.start_date;
    const e = j.end_date || j.start_date;
    if (!s) return false;
    return ds >= s && ds <= e;
  });
}

const STATUS_COLORS = {
  draft: 'bg-gray-300 text-gray-800',
  ready_to_match: 'bg-blue-200 text-blue-800',
  offers_sent: 'bg-purple-200 text-purple-800',
  assigned: 'bg-indigo-200 text-indigo-800',
  in_progress: 'bg-[#F97316] text-white',
  on_hold: 'bg-amber-200 text-amber-800',
  snagging: 'bg-yellow-200 text-yellow-800',
  completed: 'bg-green-200 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
};

export default function JobScheduleCalendar({ jobs }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const gridStart = useMemo(() => getGridStart(year, month), [year, month]);

  const days = useMemo(() => {
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [gridStart]);

  const today = new Date();
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Only show jobs that have a start_date
  const scheduledJobs = jobs.filter(j => j.start_date);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-sm">Job Schedule</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium w-36 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-1.5 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const isThisMonth = day.getMonth() === month;
          const isToday = sameDay(day, today);
          const dayJobs = jobsForDay(scheduledJobs, day);
          const showBorder = idx % 7 !== 0;

          return (
            <div
              key={idx}
              className={`min-h-[72px] p-1 border-t border-border ${showBorder ? 'border-l' : ''} ${!isThisMonth ? 'bg-muted/30' : ''}`}
            >
              <div className={`text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full font-medium ${isToday ? 'bg-[#F97316] text-white' : isThisMonth ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayJobs.slice(0, 2).map(job => (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className={`block text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium ${STATUS_COLORS[job.status] || 'bg-gray-200 text-gray-700'}`}
                    title={job.title}
                  >
                    {job.title}
                  </Link>
                ))}
                {dayJobs.length > 2 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{dayJobs.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-border flex flex-wrap gap-2">
        {[['in_progress', 'In Progress'], ['assigned', 'Assigned'], ['completed', 'Completed'], ['on_hold', 'On Hold']].map(([key, label]) => (
          <span key={key} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[key]}`}>{label}</span>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto">{scheduledJobs.length} scheduled jobs</span>
      </div>
    </div>
  );
}