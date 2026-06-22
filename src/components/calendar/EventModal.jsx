import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trash2, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const EVENT_TYPES = [
  { value: 'job_start', label: 'Job Start' },
  { value: 'job_end', label: 'Job End' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'contractor_unavailable', label: 'Contractor Unavailable' },
  { value: 'client_meeting', label: 'Client Meeting' },
  { value: 'compliance_deadline', label: 'Compliance Deadline' },
  { value: 'other', label: 'Other' },
];

function toLocalDateTimeInput(iso) {
  if (!iso) return '';
  try {
    const d = parseISO(iso);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch { return ''; }
}

function exportToICS(event) {
  const formatICSDate = (iso) => {
    const d = parseISO(iso);
    return format(d, "yyyyMMdd'T'HHmmss");
  };
  const uid = `${event.id}@ccgconnect`;
  const dtstart = formatICSDate(event.start_datetime);
  const dtend = event.end_datetime ? formatICSDate(event.end_datetime) : dtstart;
  const desc = (event.description || '').replace(/\n/g, '\\n');
  const loc = event.location || '';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CCG Connect//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${loc}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/\s+/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EventModal({ event, defaultDate, onClose, onSaved, onDeleted, canEdit }) {
  const isNew = !event?.id;
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    event_type: event?.event_type || 'other',
    start_datetime: toLocalDateTimeInput(event?.start_datetime || (defaultDate ? defaultDate.toISOString() : new Date().toISOString())),
    end_datetime: toLocalDateTimeInput(event?.end_datetime || ''),
    all_day: event?.all_day || false,
    location: event?.location || '',
    colour: event?.colour || 'orange',
    visible_to_contractor: event?.visible_to_contractor ?? true,
    visible_to_client: event?.visible_to_client ?? false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.start_datetime) return toast.error('Title and start date are required');
    setSaving(true);
    const payload = {
      ...form,
      start_datetime: new Date(form.start_datetime).toISOString(),
      end_datetime: form.end_datetime ? new Date(form.end_datetime).toISOString() : null,
    };
    if (isNew) {
      await base44.entities.CalendarEvent.create(payload);
      toast.success('Event created');
    } else {
      await base44.entities.CalendarEvent.update(event.id, payload);
      toast.success('Event updated');
    }
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    await base44.entities.CalendarEvent.update(event.id, { archived: true });
    toast.success('Event removed');
    onDeleted();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New Event' : canEdit ? 'Edit Event' : 'Event Details'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Event title" disabled={!canEdit} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.event_type} onValueChange={v => set('event_type', v)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Colour</Label>
              <Select value={form.colour} onValueChange={v => set('colour', v)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['orange','navy','green','red','amber','slate'].map(c => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start *</Label>
              <Input type="datetime-local" value={form.start_datetime} onChange={e => set('start_datetime', e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="datetime-local" value={form.end_datetime} onChange={e => set('end_datetime', e.target.value)} disabled={!canEdit} />
            </div>
          </div>

          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Address or site" disabled={!canEdit} />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} disabled={!canEdit} />
          </div>

          {canEdit && (
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.visible_to_contractor} onCheckedChange={v => set('visible_to_contractor', v)} id="vtc" />
                <Label htmlFor="vtc" className="text-xs">Contractors see</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.visible_to_client} onCheckedChange={v => set('visible_to_client', v)} id="vcc" />
                <Label htmlFor="vcc" className="text-xs">Clients see</Label>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {canEdit && (
              <>
                <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#F97316] hover:bg-[#ea6a0a] text-white">
                  {saving ? 'Saving…' : isNew ? 'Create Event' : 'Save Changes'}
                </Button>
                {!isNew && (
                  <Button variant="outline" size="icon" onClick={handleDelete} className="text-destructive border-destructive hover:bg-destructive hover:text-white">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
            {!isNew && (
              <Button variant="outline" size="icon" title="Export to device calendar (.ics)" onClick={() => exportToICS(event)}>
                <Download className="w-4 h-4" />
              </Button>
            )}
            {!canEdit && <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}