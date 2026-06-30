import { useEffect, useState, useCallback } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const EMPTY = { date: today(), weather: '', headcount: '', work_summary: '', issues: '' };

/** Daily site diary for a deployment. */
export function DeploymentDiary({ deploymentId }) {
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.deployments.diary.list(deploymentId).catch(() => ({ entries: [] }));
    setEntries(r.entries ?? []);
  }, [deploymentId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    if (!form.date) return;
    setBusy(true);
    try {
      await api.deployments.diary.create(deploymentId, {
        date: form.date,
        weather: form.weather || undefined,
        headcount: form.headcount ? Number(form.headcount) : undefined,
        work_summary: form.work_summary || undefined,
        issues: form.issues || undefined,
      });
      setForm({ ...EMPTY, date: today() });
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen((v) => !v)}><Plus size={14} /> Add entry</Button>
      </div>
      {open && (
        <form onSubmit={create} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-4">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Date" />
          <Input placeholder="Weather" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} />
          <Input type="number" min="0" placeholder="Headcount" value={form.headcount} onChange={(e) => setForm({ ...form, headcount: e.target.value })} />
          <div />
          <Textarea className="sm:col-span-4" rows={2} placeholder="Work summary" value={form.work_summary} onChange={(e) => setForm({ ...form, work_summary: e.target.value })} />
          <Textarea className="sm:col-span-4" rows={2} placeholder="Issues / delays" value={form.issues} onChange={(e) => setForm({ ...form, issues: e.target.value })} />
          <div className="sm:col-span-4"><Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</Button></div>
        </form>
      )}
      {entries.length === 0 && <p className="text-xs text-muted-foreground">No diary entries yet.</p>}
      {entries.map((d) => (
        <div key={d.id} className="rounded-md border p-2.5 text-sm">
          <p className="font-medium">{d.date}{d.weather ? ` · ${d.weather}` : ''}{d.headcount != null ? ` · ${d.headcount} on site` : ''}</p>
          {d.work_summary && <p className="mt-0.5 text-muted-foreground">{d.work_summary}</p>}
          {d.issues && <p className="mt-0.5 text-amber-700 dark:text-amber-400">Issues: {d.issues}</p>}
        </div>
      ))}
    </div>
  );
}
