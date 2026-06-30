import { useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { PERFORMANCE_DIMENSIONS, requiresEvidence, PERFORMANCE_GUARDRAIL } from '@/domain/commercial/performance';

const DIRECTION_TITLE = {
  client_on_worker: 'Rate worker',
  worker_on_site: 'Site feedback',
};

function ScoreRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-7 w-7 rounded-md border text-xs font-semibold transition-colors ${
              value === n
                ? n <= 2 ? 'border-red-500 bg-red-500 text-white' : 'border-primary bg-primary text-primary-foreground'
                : 'border-input text-muted-foreground hover:bg-muted'
            }`}
            aria-label={`${label}: ${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Record a performance/quality review (a client rating a worker, or a worker's
 * feedback on the site). Evidence is mandatory when any score is poor (1–2) —
 * enforced here and on the server. Reviews inform decisions, never auto-exclude.
 */
export function PerformanceReviewDialog({ deploymentId, workerId, workerName, direction, open, onClose, onSaved }) {
  const dims = PERFORMANCE_DIMENSIONS[direction] ?? [];
  const [scores, setScores] = useState({});
  const [wouldRepeat, setWouldRepeat] = useState(null);
  const [comment, setComment] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);

  const needEvidence = requiresEvidence(scores);
  const complete = dims.length > 0 && dims.every((d) => scores[d.key]);
  const canSubmit = complete && (!needEvidence || evidence.trim()) && !busy;

  function reset() {
    setScores({}); setWouldRepeat(null); setComment(''); setEvidence('');
  }

  async function submit() {
    setBusy(true);
    try {
      await api.performance.create({
        deployment_id: deploymentId,
        worker_id: workerId,
        direction,
        scores,
        would_repeat: wouldRepeat ?? undefined,
        comment: comment.trim() || undefined,
        evidence: evidence.trim() || undefined,
      });
      reset();
      onSaved?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{DIRECTION_TITLE[direction]}{workerName ? ` — ${workerName}` : ''}</DialogTitle>
          <DialogDescription>
            {direction === 'client_on_worker' ? "Score the worker's performance on this assignment." : 'Feedback on the site for this assignment.'} 1 = poor, 5 = excellent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          {dims.map((d) => (
            <ScoreRow key={d.key} label={d.label} value={scores[d.key]} onChange={(n) => setScores({ ...scores, [d.key]: n })} />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">{direction === 'client_on_worker' ? 'Would use again?' : 'Would return?'}</span>
          <div className="flex gap-1">
            <Button size="sm" variant={wouldRepeat === true ? 'default' : 'outline'} onClick={() => setWouldRepeat(true)}>Yes</Button>
            <Button size="sm" variant={wouldRepeat === false ? 'default' : 'outline'} onClick={() => setWouldRepeat(false)}>No</Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Comment (optional)</Label>
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        {needEvidence && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle size={12} /> Evidence required for a poor score
            </Label>
            <Textarea rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="What happened, with specifics — this can be disputed by the worker." className="border-red-300/60" />
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">{PERFORMANCE_GUARDRAIL}</p>

        <Button onClick={submit} disabled={!canSubmit} className="w-full">
          {busy ? 'Saving…' : 'Save review'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
