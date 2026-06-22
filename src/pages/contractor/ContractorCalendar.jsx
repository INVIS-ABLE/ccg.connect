import { useState, useEffect, useCallback } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import EventModal from '@/components/calendar/EventModal';
import { parseISO } from 'date-fns';

function exportAllToICS(events) {
  const formatICSDate = (iso) => {
    const d = parseISO(iso);
    return format(d, "yyyyMMdd'T'HHmmss");
  };
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CCG Connect//EN',
  ];
  events.forEach(ev => {
    const dtstart = formatICSDate(ev.start_datetime);
    const dtend = ev.end_datetime ? formatICSDate(ev.end_datetime) : dtstart;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@ccgconnect`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${(ev.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${ev.location || ''}`,
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'My_CCG_Schedule.ics';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContractorCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const all = await base44.entities.CalendarEvent.filter({ archived: false, visible_to_contractor: true });
    setEvents(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  return (
    <div className="flex flex-col h-screen overflow-hidden pb-16">
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold">My Schedule</h1>
          <Button variant="outline" size="sm" onClick={() => exportAllToICS(events)} title="Add all to device calendar">
            <Download className="w-4 h-4 mr-1" />
            Sync
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Tap Sync to add events to your device calendar</p>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold w-32 text-center">{format(currentDate, 'MMMM yyyy')}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCurrentDate(new Date())}>
            <CalendarDays className="w-3.5 h-3.5 mr-1" />Today
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-4 border-muted border-t-[#F97316] rounded-full animate-spin" />
        </div>
      ) : (
        <CalendarGrid
          currentDate={currentDate}
          events={events}
          onDayClick={() => {}}
          onEventClick={ev => setSelectedEvent(ev)}
        />
      )}

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSaved={() => { setSelectedEvent(null); loadEvents(); }}
          onDeleted={() => { setSelectedEvent(null); loadEvents(); }}
          canEdit={false}
        />
      )}
    </div>
  );
}