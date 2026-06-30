import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileBadge, Plus, CheckCircle2 } from 'lucide-react';
import { KidEditorDialog } from './KidEditorDialog';

const STATUS_LABEL = {
  draft: { text: 'Draft', cls: 'bg-muted text-muted-foreground' },
  issued: { text: 'Issued — awaiting acknowledgement', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  acknowledged: { text: 'Acknowledged', cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' },
  superseded: { text: 'Superseded', cls: 'bg-muted text-muted-foreground line-through' },
};

/**
 * Key Information Documents for a deployment — one per worker. Ops create a draft
 * (prefilled), edit, issue, then record the worker's acknowledgement. The wording
 * is a draft pending employment-law sign-off (see KidEditorDialog).
 */
export function KidPanel({ deploymentId, members }) {
  const [kids, setKids] = useState([]);
  const [editing, setEditing] = useState(null); // { kid, workerName }
  const [busyWorker, setBusyWorker] = useState(null);

  const fetchKids = useCallback(
    () => api.kids.list(deploymentId).then((r) => r.kids ?? []).catch(() => []),
    [deploymentId],
  );
  useEffect(() => {
    let alive = true;
    void fetchKids().then((k) => alive && setKids(k));
    return () => { alive = false; };
  }, [fetchKids]);

  // Latest KID per worker (the list is newest-first).
  const latestByWorker = new Map();
  for (const k of kids) if (!latestByWorker.has(k.worker_id)) latestByWorker.set(k.worker_id, k);

  const nameOf = (workerId) => members.find((m) => m.worker_id === workerId)?.worker?.full_name ?? 'Worker';

  // Reload, and keep the open editor's KID in sync after a save.
  async function refresh() {
    const next = await fetchKids();
    setKids(next);
    setEditing((cur) => {
      if (!cur) return cur;
      const updated = next.find((k) => k.id === cur.kid.id);
      return updated ? { ...cur, kid: updated } : cur;
    });
  }

  async function createFor(workerId) {
    setBusyWorker(workerId);
    try {
      const { kid } = await api.kids.create({ deployment_id: deploymentId, worker_id: workerId });
      setKids(await fetchKids());
      setEditing({ kid, workerName: nameOf(workerId) });
    } finally {
      setBusyWorker(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><FileBadge size={15} /> Key Information Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.length === 0 && <p className="text-xs text-muted-foreground">Add workers to the deployment first.</p>}
        {members.map((m) => {
          const kid = latestByWorker.get(m.worker_id);
          const label = kid ? STATUS_LABEL[kid.status] : null;
          return (
            <div key={m.worker_id} className="flex items-center gap-3 border-b py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.worker?.full_name ?? 'Worker'}</p>
                {label ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${label.cls}`}>
                    {kid.status === 'acknowledged' && <CheckCircle2 size={10} />} {label.text}{kid.version > 1 ? ` · v${kid.version}` : ''}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">No document yet</span>
                )}
              </div>
              {kid ? (
                <Button size="sm" variant="outline" onClick={() => setEditing({ kid, workerName: m.worker?.full_name })}>Open</Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" disabled={busyWorker === m.worker_id} onClick={() => createFor(m.worker_id)}>
                  <Plus size={13} /> {busyWorker === m.worker_id ? 'Creating…' : 'Create'}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>

      <KidEditorDialog
        kid={editing?.kid}
        workerName={editing?.workerName}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </Card>
  );
}
