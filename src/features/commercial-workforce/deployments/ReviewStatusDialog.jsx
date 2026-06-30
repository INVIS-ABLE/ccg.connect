import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Star, ThumbsUp, ThumbsDown, Flag, CheckCircle2, Undo2 } from 'lucide-react';
import { PERFORMANCE_DIMENSIONS } from '@/domain/commercial/performance';

const STATUS_VARIANT = { recorded: 'secondary', disputed: 'default', upheld: 'outline', withdrawn: 'outline' };

/**
 * Ops view of a single performance review with its appeal workflow: mark a
 * review disputed (e.g. after the worker raises it by phone), then uphold or
 * withdraw it. The dispute reason / resolution is recorded in the comment.
 */
export function ReviewStatusDialog({ review, open, onClose, onSaved }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (review) setComment(review.comment ?? ''); }, [review]);
  if (!review) return null;

  const dims = PERFORMANCE_DIMENSIONS[review.direction] ?? [];
  const labelOf = (key) => dims.find((d) => d.key === key)?.label ?? key;

  async function setStatus(status) {
    setBusy(true);
    try {
      await api.performance.update(review.id, { status, comment: comment.trim() || undefined });
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
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {review.direction === 'client_on_worker' ? 'Client rating' : 'Site feedback'}
            {review.overall != null && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold"><Star size={13} className="fill-amber-400 text-amber-400" /> {review.overall.toFixed(1)}/5</span>
            )}
            {review.would_repeat === true && <ThumbsUp size={13} className="text-green-600" />}
            {review.would_repeat === false && <ThumbsDown size={13} className="text-red-600" />}
            <Badge variant={STATUS_VARIANT[review.status]} className="capitalize">{review.status}</Badge>
          </DialogTitle>
          <DialogDescription>Scores are restricted to ops. Use the appeal workflow to dispute, uphold or withdraw.</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
          {Object.entries(review.scores ?? {}).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <dt className="text-xs text-muted-foreground">{labelOf(k)}</dt>
              <dd className={`font-semibold ${v <= 2 ? 'text-red-600' : ''}`}>{v}/5</dd>
            </div>
          ))}
        </dl>

        {review.evidence && (
          <div className="rounded-md bg-amber-50 p-2.5 text-xs dark:bg-amber-950/30">
            <span className="font-medium text-amber-700 dark:text-amber-300">Evidence: </span>
            <span className="text-muted-foreground">{review.evidence}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Comment / dispute reason / resolution</Label>
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2">
          {review.status !== 'disputed' && review.status !== 'withdrawn' && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('disputed')} className="gap-1.5">
              <Flag size={14} /> Mark disputed
            </Button>
          )}
          {review.status === 'disputed' && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('upheld')} className="gap-1.5">
              <CheckCircle2 size={14} /> Uphold
            </Button>
          )}
          {review.status !== 'withdrawn' && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('withdrawn')} className="gap-1.5">
              <Undo2 size={14} /> Withdraw
            </Button>
          )}
          <Button size="sm" disabled={busy} onClick={() => setStatus(review.status)} className="ml-auto">
            {busy ? 'Saving…' : 'Save comment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
