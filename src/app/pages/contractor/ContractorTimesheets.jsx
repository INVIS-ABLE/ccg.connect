import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const emptyEntry = () => ({ work_date: '', start_time: '', finish_time: '', break_minutes: 0, rate: 0 });

export default function ContractorTimesheets() {
  const [timesheets, setTimesheets] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [entries, setEntries] = useState([emptyEntry()]);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.timesheets.list();
      setTimesheets(r.timesheets);
    } catch {
      setError('Could not load timesheets.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function updateEntry(i, patch) {
    setEntries((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.timesheets.submit({
        job_id: jobId,
        week_start: weekStart,
        entries: entries.map((en) => ({
          work_date: en.work_date || weekStart,
          start_time: en.start_time,
          finish_time: en.finish_time,
          break_minutes: Number(en.break_minutes) || 0,
          rate: Number(en.rate) || 0,
        })),
      });
      setOpen(false);
      setJobId('');
      setWeekStart('');
      setEntries([emptyEntry()]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? `Could not submit (${err.status}).` : 'Could not submit timesheet.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Timesheets</h1>
        <Button onClick={() => setOpen((v) => !v)}>{open ? 'Cancel' : 'Submit timesheet'}</Button>
      </div>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>New timesheet</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="job">Job ID</Label>
                  <Input id="job" required value={jobId} onChange={(e) => setJobId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="week">Week starting</Label>
                  <Input id="week" type="date" required value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                {entries.map((en, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                    <Input type="date" aria-label="Date" value={en.work_date} onChange={(e) => updateEntry(i, { work_date: e.target.value })} />
                    <Input type="time" aria-label="Start" value={en.start_time} onChange={(e) => updateEntry(i, { start_time: e.target.value })} required />
                    <Input type="time" aria-label="Finish" value={en.finish_time} onChange={(e) => updateEntry(i, { finish_time: e.target.value })} required />
                    <Input type="number" min="0" aria-label="Break (min)" placeholder="break" value={en.break_minutes} onChange={(e) => updateEntry(i, { break_minutes: e.target.value })} />
                    <Input type="number" min="0" step="0.01" aria-label="Rate" placeholder="rate" value={en.rate} onChange={(e) => updateEntry(i, { rate: e.target.value })} />
                    <Button type="button" variant="ghost" onClick={() => setEntries((r) => r.filter((_, idx) => idx !== i))} disabled={entries.length === 1}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setEntries((r) => [...r, emptyEntry()])}>
                  Add day
                </Button>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={saving}>
                {saving ? 'Submitting…' : 'Submit'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {!error && timesheets === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {timesheets?.length === 0 && <p className="text-sm text-muted-foreground">No timesheets yet.</p>}
          {timesheets && timesheets.length > 0 && (
            <ul className="divide-y">
              {timesheets.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">Week of {t.week_start}</div>
                    <div className="text-sm text-muted-foreground">
                      {t.total_hours ?? 0} h
                      {t.total_amount != null ? ` · £${t.total_amount}` : ''}
                    </div>
                  </div>
                  <Badge variant="secondary">{t.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
