import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Plus, AlertTriangle } from 'lucide-react';
import { INCIDENT_TYPES, INCIDENT_SEVERITIES, incidentTypeLabel, requiresUrgentEscalation } from '@/domain/commercial/incidents';

const SEV_COLOR = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

export default function Incidents() {
  const [rows, setRows] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: 'near_miss', severity: 'medium', occurred_at: '', description: '', immediate_action: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await api.incidents.list().catch(() => ({ incidents: [] }));
    setRows(r.incidents ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await api.incidents.create({ ...payload, type: form.type });
      setForm({ type: 'near_miss', severity: 'medium', occurred_at: '', description: '', immediate_action: '' });
      setCreating(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const willEscalate = requiresUrgentEscalation(form.type, form.severity);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldAlert className="text-primary" size={22} /> Incidents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Accidents, near misses, concerns and complaints. Urgent reports alert the ops team immediately.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreating((v) => !v)}><Plus size={16} /> Report incident</Button>
      </div>

      {creating && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Report an incident</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{incidentTypeLabel(t)}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm capitalize" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  {INCIDENT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>When</Label><Input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>What happened</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Immediate action taken</Label><Textarea rows={2} value={form.immediate_action} onChange={(e) => setForm({ ...form, immediate_action: e.target.value })} /></div>
              {willEscalate && (
                <p className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 sm:col-span-2">
                  <AlertTriangle size={13} /> This will be flagged urgent and alert the ops team immediately.
                </p>
              )}
              <div className="sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'Reporting…' : 'Submit report'}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows?.length === 0 && <p className="text-sm text-muted-foreground">No incidents recorded.</p>}

      <div className="grid gap-3">
        {rows?.map((i) => (
          <Card key={i.id}>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {incidentTypeLabel(i.type)}
                  {i.urgent && <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300"><AlertTriangle size={10} /> Urgent</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{i.description || 'No description'}{i.occurred_at ? ` · ${new Date(i.occurred_at).toLocaleString('en-GB')}` : ''}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${SEV_COLOR[i.severity]}`}>{i.severity}</span>
              <Badge variant="secondary" className="capitalize">{i.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
