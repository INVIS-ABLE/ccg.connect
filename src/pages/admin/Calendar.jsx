import { useState, useEffect, useCallback } from 'react';
import { format, addMonths, subMonths, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import EventModal from '@/components/calendar/EventModal';
import PageHeader from '@/components/shared/PageHeader';
import { useUserProfile } from '@/lib/useUserProfile';
import { isAdmin } from '@/lib/roles';

function exportAllToICS(events) {
  const formatICSDate = (iso) => {
    const d = parseISO(iso);
    return format(d, "yyyyMMdd'T'HHmmss");
  };
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CCG Connect//EN',
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
  a.download = 'CCG_Calendar.ics';
  a.click();
  URL.revokeObjectURL(url);
}

export default function CalendarPage() {
  const { userProfile } = useUserProfile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [newEventDate, setNewEventDate] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const canEdit = isAdmin(userProfile?.role);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const all = await base44.entities.CalendarEvent.filter({ archived: false });
    setEvents(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleDayClick = (day) => {
    if (!canEdit) return;
    setSelectedEvent(null);
    setNewEventDate(day);
    setShowModal(true);
  };

  const handleEventClick = (ev) => {
    setSelectedEvent(ev);
    setNewEventDate(null);
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setSelectedEvent(null);
    setNewEventDate(null);
  };

  const handleSaved = () => {
    handleClose();
    loadEvents();
  };

  const handleDeleted = () => {
    handleClose();
    loadEvents();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <PageHeader
          title="Shared Calendar"
          subtitle="Job dates, site visits and team events"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportAllToICS(events)} title="Export all to device calendar">
                <Download className="w-4 h-4 mr-1" />
                Export .ics
              </Button>
              {canEdit && (
                <Button size="sm" className="bg-[#F97316] hover:bg-[#ea6a0a] text-white" onClick={() => { setSelectedEvent(null); setNewEventDate(new Date()); setShowModal(true); }}>
                  <Plus className="w-4 h-4 mr-1" />
                  New Event
                </Button>
              )}
            </div>
          }
        />

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-base font-bold text-foreground w-36 text-center">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            <CalendarDays className="w-3.5 h-3.5 mr-1" />
            Today
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-3">
          {[
            { label: 'Job Start', colour: 'bg-[#F97316]' },
            { label: 'Job End', colour: 'bg-[#1e3a5f]' },
            { label: 'Site Visit', colour: 'bg-green-600' },
            { label: 'Compliance', colour: 'bg-red-500' },
            { label: 'Meeting', colour: 'bg-amber-500' },
            { label: 'Other', colour: 'bg-slate-500' },
          ].map(({ label, colour }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${colour}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-muted border-t-[#F97316] rounded-full animate-spin" />
        </div>
      ) : (
        <CalendarGrid
          currentDate={currentDate}
          events={events}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />
      )}

      {showModal && (
        <EventModal
          event={selectedEvent}
          defaultDate={newEventDate}
          onClose={handleClose}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}