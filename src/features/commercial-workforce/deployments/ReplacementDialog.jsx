import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, AlertTriangle, X, ShieldCheck, UserCog } from 'lucide-react';

const CELL = {
  ok: <Check size={13} className="text-green-600" />,
  warning: <AlertTriangle size={13} className="text-amber-600" />,
  missing: <X size={13} className="text-red-600" />,
};

/**
 * Find-a-replacement flow. Surfaces available workers ranked best-first against
 * the deployment's own requirements — every candidate is checked individually,
 * never waved through. Picking one swaps the slot (preserving role/rates) and
 * writes an audit row.
 */
export function ReplacementDialog({ deploymentId, worker, onClose, onReplaced }) {
  const open = !!worker;
  const [state, setState] = useState({ loading: true, requirements: [], candidates: [] });
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState({ loading: true, requirements: [], candidates: [] });
    setReason('');
    setError(null);
    api.deployments.replacements
      .candidates(deploymentId)
      .then((r) => {
        if (alive) setState({ loading: false, requirements: r.requirements ?? [], candidates: r.candidates ?? [] });
      })
      .catch(() => {
        if (alive) setState({ loading: false, requirements: [], candidates: [] });
      });
    return () => {
      alive = false;
    };
  }, [open, deploymentId]);

  async function pick(candidate) {
    if (!worker) return;
    setBusyId(candidate.workerId);
    setError(null);
    try {
      await api.deployments.replacements.create(deploymentId, {
        original_worker_id: worker.worker_id,
        replacement_worker_id: candidate.workerId,
        reason: reason.trim() || undefined,
      });
      onReplaced?.();
      onClose?.();
    } catch {
      setError('Could not record the replacement. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCog size={16} /> Replace {worker?.worker?.full_name ?? 'worker'}
          </DialogTitle>
          <DialogDescription>
            Available workers ranked by compliance against this deployment&rsquo;s requirements. Each is checked
            individually — a green shield means deployable now.
          </DialogDescription>
        </DialogHeader>

        <label className="block text-xs font-medium">
          Reason <span className="font-normal text-muted-foreground">(optional — recorded in the audit trail)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. absence, sickness, performance"
            className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {state.loading && <p className="text-xs text-muted-foreground">Finding candidates…</p>}
          {!state.loading && state.candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">No other active workers available to swap in.</p>
          )}
          {state.candidates.map((cand) => (
            <div key={cand.workerId} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{cand.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {state.requirements.map((r) => (
                    <span key={r} className="inline-flex items-center gap-1">
                      {CELL[cand.compliance.cells[r]] ?? <X size={13} className="text-red-600" />} {r}
                    </span>
                  ))}
                </div>
              </div>
              {cand.compliance.deployable ? (
                <ShieldCheck size={16} className="text-green-600" title="Deployable" />
              ) : (
                <AlertTriangle size={16} className="text-amber-600" title="Not fully compliant" />
              )}
              <Button
                size="sm"
                variant={cand.compliance.deployable ? 'default' : 'outline'}
                disabled={!!busyId}
                onClick={() => pick(cand)}
              >
                {busyId === cand.workerId ? 'Swapping…' : 'Swap in'}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
