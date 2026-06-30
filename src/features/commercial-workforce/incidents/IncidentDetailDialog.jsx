import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertTriangle, Lock, PlayCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { incidentTypeLabel } from '@/domain/commercial/incidents';

const SEV_COLOR = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

const LINK_FIELDS = [
  ['site_id', 'Site'],
  ['deployment_id', 'Deployment'],
  ['worker_id', 'Worker'],
  ['gang_id', 'Gang'],
  ['account_id', 'Account'],
];

/**
 * Incident detail + investigation workflow. Ops record the immediate action,
 * witnesses, investigation and outcome, and move the incident open →
 * investigating → closed. restricted_notes are sensitive (ops register only).
 */
export function IncidentDetailDialog({ incident, open, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (incident) {
      setForm({
        status: incident.status,
        description: incident.description ?? '',
        immediate_action: incident.immediate_action ?? '',
        witnesses: incident.witnesses ?? '',
        investigation: incident.investigation ?? '',
        outcome: incident.outcome ?? '',
        restricted_notes: incident.restricted_notes ?? '',
      });
    }
  }, [incident]);

  if (!incident || !form) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(extra = {}) {
    setSaving(true);
    try {
      const next = { ...form, ...extra };
      await api.incidents.update(incident.id, next);
      setForm(next);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  const links = LINK_FIELDS.filter(([k]) => incident[k]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {incidentTypeLabel(incident.type)}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${SEV_COLOR[incident.severity]}`}>{incident.severity}</span>
            {incident.urgent && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                <AlertTriangle size={10} /> Urgent
              </span>
            )}
            <Badge variant="secondary" className="capitalize">{form.status}</Badge>
          </DialogTitle>
          <DialogDescription>
            {incident.occurred_at ? `Occurred ${new Date(incident.occurred_at).toLocaleString('en-GB')}` : 'Time not recorded'}
          </DialogDescription>
        </DialogHeader>

        {links.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {links.map(([k, label]) => (
              <span key={k} className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {label}: {String(incident[k]).slice(0, 8)}
              </span>
            ))}
          </div>
        )}

        {/* Status workflow */}
        <div className="flex flex-wrap gap-2">
          {form.status !== 'investigating' && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => save({ status: 'investigating' })} className="gap-1.5">
              <PlayCircle size={14} /> Start investigation
            </Button>
          )}
          {form.status !== 'closed' && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => save({ status: 'closed' })} className="gap-1.5">
              <CheckCircle2 size={14} /> Close
            </Button>
          )}
          {form.status === 'closed' && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => save({ status: 'open' })} className="gap-1.5">
              <RotateCcw size={14} /> Reopen
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <Field label="What happened"><Textarea rows={3} value={form.description} onChange={set('description')} /></Field>
          <Field label="Immediate action taken"><Textarea rows={2} value={form.immediate_action} onChange={set('immediate_action')} /></Field>
          <Field label="Witnesses"><Input value={form.witnesses} onChange={set('witnesses')} placeholder="Names / contact" /></Field>
          <Field label="Investigation"><Textarea rows={3} value={form.investigation} onChange={set('investigation')} placeholder="Findings, root cause, actions…" /></Field>
          <Field label="Outcome"><Textarea rows={2} value={form.outcome} onChange={set('outcome')} placeholder="Resolution, preventive measures…" /></Field>
          <Field label={<span className="flex items-center gap-1"><Lock size={12} /> Restricted notes — ops register only</span>}>
            <Textarea rows={2} value={form.restricted_notes} onChange={set('restricted_notes')} className="border-amber-300/60" />
          </Field>
        </div>

        <Button onClick={() => save()} disabled={saving} className="w-full">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
