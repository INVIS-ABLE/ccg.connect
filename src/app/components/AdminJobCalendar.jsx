import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_COLORS = {
  draft: 'bg-gray-300',
  enquiry: 'bg-blue-400',
  quoted: 'bg-yellow-400',
  confirmed: 'bg-indigo-400',
  in_progress: 'bg-orange-400',
  completed: 'bg-green-500',
  cancelled: 'bg-red-300',
};

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function jobsForDay(jobs, year, month, day) {
  const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return jobs.filter((j) => {
    if (!j.start_date) return false;
    const start = j.start_date.slice(0, 10);
    const end = (j.end_date || j.start_date).slice(0, 10);
    return dayStr >= start && dayStr <= end;
  });
}

export default function AdminJobCalendar({ jobs }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tooltip, setTooltip] = useState(null); // { day, jobs }

  const numDays = daysInMonth(year, month);
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  // Convert to Mon-start (0=Mon)
  const offset = (firstDow + 6) % 7;

  const activeJobs = useMemo(
    () => (jobs || []).filter((j) => !['cancelled'].includes(j.status) && j.start_date),
    [jobs]
  );

  function prev() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= numDays; d++) cells.push(d);

  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prev}><ChevronLeft size={16} /></Button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <Button variant="ghost" size="icon" onClick={next}><ChevronRight size={16} /></Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px text-center">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
          <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const dayJobs = jobsForDay(activeJobs, year, month, day);
          const isToday = day === todayDay;
          return (
            <div
              key={day}
              className={`relative min-h-[52px] rounded p-1 cursor-default border
                ${isToday ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/40'}`}
              onMouseEnter={() => dayJobs.length && setTooltip({ day, jobs: dayJobs })}
              onMouseLeave={() => setTooltip(null)}
            >
              <span className={`text-xs font-medium leading-none ${isToday ? 'text-primary' : 'text-foreground'}`}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayJobs.slice(0, 3).map((j) => (
                  <div
                    key={j.id}
                    className={`h-1.5 rounded-full ${STATUS_COLORS[j.status] ?? 'bg-gray-400'}`}
                    title={j.title}
                  />
                ))}
                {dayJobs.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">+{dayJobs.length - 3}</span>
                )}
              </div>

              {/* Tooltip */}
              {tooltip?.day === day && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-20 bg-popover border shadow-lg rounded-lg p-2 min-w-[160px] pointer-events-none">
                  <p className="text-xs font-semibold mb-1 text-foreground">
                    {new Date(year, month, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                  {tooltip.jobs.map((j) => (
                    <div key={j.id} className="flex items-center gap-1.5 py-0.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[j.status] ?? 'bg-gray-400'}`} />
                      <span className="text-xs text-foreground truncate max-w-[120px]">{j.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
        {Object.entries(STATUS_COLORS).map(([s, cls]) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${cls}`} />
            <span className="text-[10px] text-muted-foreground capitalize">{s.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}