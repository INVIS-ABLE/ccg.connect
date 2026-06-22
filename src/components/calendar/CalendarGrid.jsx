import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO } from 'date-fns';

const EVENT_COLOURS = {
  orange: 'bg-[#F97316] text-white',
  navy: 'bg-[#1e3a5f] text-white',
  green: 'bg-green-600 text-white',
  red: 'bg-red-500 text-white',
  amber: 'bg-amber-500 text-white',
  slate: 'bg-slate-500 text-white',
};

const TYPE_COLOURS = {
  job_start: 'orange',
  job_end: 'navy',
  site_visit: 'green',
  contractor_unavailable: 'slate',
  client_meeting: 'amber',
  compliance_deadline: 'red',
  other: 'slate',
};

export function getEventColourClass(event) {
  const key = event.colour || TYPE_COLOURS[event.event_type] || 'slate';
  return EVENT_COLOURS[key] || EVENT_COLOURS.slate;
}

export default function CalendarGrid({ currentDate, events, onDayClick, onEventClick }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getEventsForDay = (day) =>
    events.filter(e => {
      const start = parseISO(e.start_datetime);
      return isSameDay(start, day);
    });

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Week header */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={cn(
                'border-r border-b border-border p-1 min-h-[80px] cursor-pointer hover:bg-accent/40 transition-colors',
                !inMonth && 'bg-muted/30',
                today && 'bg-[#F97316]/5'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1',
                today ? 'bg-[#F97316] text-white' : inMonth ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(ev => (
                  <div
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80',
                      getEventColourClass(ev)
                    )}
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}