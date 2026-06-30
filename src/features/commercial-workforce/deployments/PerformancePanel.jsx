import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Building2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { PerformanceReviewDialog } from './PerformanceReviewDialog';

function Overall({ value }) {
  if (value == null) return null;
  const tone = value <= 2.5 ? 'text-red-600' : value < 4 ? 'text-amber-600' : 'text-green-600';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
      <Star size={12} className="fill-current" /> {value.toFixed(1)}/5
    </span>
  );
}

/**
 * Performance & quality reviews for a completed assignment. Ops record a client
 * rating of each worker and the worker's feedback on the site. Latest review per
 * direction is summarised; poor scores carry evidence and can be disputed.
 */
export function PerformancePanel({ deploymentId, members }) {
  const [reviews, setReviews] = useState([]);
  const [dialog, setDialog] = useState(null); // { workerId, workerName, direction }

  const fetchReviews = useCallback(
    () => api.performance.list({ deploymentId }).then((r) => r.reviews ?? []).catch(() => []),
    [deploymentId],
  );
  useEffect(() => {
    let alive = true;
    void fetchReviews().then((r) => alive && setReviews(r));
    return () => { alive = false; };
  }, [fetchReviews]);

  const refresh = async () => setReviews(await fetchReviews());

  // Latest review per (worker, direction).
  const latest = (workerId, direction) =>
    reviews.find((r) => r.worker_id === workerId && r.direction === direction) ?? null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Star size={15} /> Performance &amp; quality</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.length === 0 && <p className="text-xs text-muted-foreground">Add workers to the deployment first.</p>}
        {members.map((m) => {
          const client = latest(m.worker_id, 'client_on_worker');
          const site = latest(m.worker_id, 'worker_on_site');
          return (
            <div key={m.worker_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2 last:border-0">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.worker?.full_name ?? 'Worker'}</span>
              {client && (
                <span className="flex items-center gap-1">
                  <Overall value={client.overall} />
                  {client.would_repeat === true && <ThumbsUp size={12} className="text-green-600" />}
                  {client.would_repeat === false && <ThumbsDown size={12} className="text-red-600" />}
                  {client.status !== 'recorded' && <span className="text-[10px] capitalize text-amber-600">· {client.status}</span>}
                </span>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialog({ workerId: m.worker_id, workerName: m.worker?.full_name, direction: 'client_on_worker' })}>
                <Star size={13} /> {client ? 'Re-rate' : 'Rate worker'}
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setDialog({ workerId: m.worker_id, workerName: m.worker?.full_name, direction: 'worker_on_site' })}>
                <Building2 size={13} /> {site ? 'Site ✓' : 'Site feedback'}
              </Button>
            </div>
          );
        })}
      </CardContent>

      {dialog && (
        <PerformanceReviewDialog
          deploymentId={deploymentId}
          workerId={dialog.workerId}
          workerName={dialog.workerName}
          direction={dialog.direction}
          open
          onClose={() => setDialog(null)}
          onSaved={refresh}
        />
      )}
    </Card>
  );
}
