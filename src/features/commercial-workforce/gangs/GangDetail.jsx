import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Check, AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { complianceMatrix, mergeRequirements, RTW_REQUIREMENT } from '@/domain/workforce/compliance';

const CELL = {
  ok: { icon: <Check size={14} className="text-green-600" />, label: 'OK' },
  warning: { icon: <AlertTriangle size={14} className="text-amber-600" />, label: 'Expiring' },
  missing: { icon: <X size={14} className="text-red-600" />, label: 'Missing' },
};

export default function GangDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const [gang, setGang] = useState(null);
  const [members, setMembers] = useState([]);
  const [allWorkers, setAllWorkers] = useState([]);
  const [pick, setPick] = useState({ worker_id: '', role: 'permanent' });
  const [reqInput, setReqInput] = useState('RTW, CSCS');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [g, w] = await Promise.all([
      api.gangs.get(id).catch(() => null),
      api.workers.list().catch(() => ({ workers: [] })),
    ]);
    if (g) {
      setGang(g.gang);
      setMembers(g.members ?? []);
    }
    setAllWorkers(w.workers ?? []);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function addMember(e) {
    e.preventDefault();
    if (!pick.worker_id) return;
    setBusy(true);
    try {
      await api.gangs.addMember(id, pick);
      setPick({ worker_id: '', role: 'permanent' });
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function removeMember(memberId) {
    await api.gangs.removeMember(id, memberId);
    await load();
  }

  // Requirements (RTW always included) → compliance matrix over current members.
  const requirements = useMemo(
    () => mergeRequirements([RTW_REQUIREMENT], reqInput.split(',').map((s) => s.trim()).filter(Boolean)),
    [reqInput],
  );
  const matrix = useMemo(() => {
    const inputs = members
      .filter((m) => m.worker)
      .map((m) => ({
        id: m.worker_id,
        full_name: m.worker.full_name,
        right_to_work_status: m.worker.right_to_work_status,
        rtw_expiry: m.worker.rtw_expiry,
        cards: m.worker.cards ?? [],
      }));
    return complianceMatrix(inputs, requirements, now);
  }, [members, requirements, now]);

  const memberWorkerIds = new Set(members.map((m) => m.worker_id));
  const addable = allWorkers.filter((w) => !memberWorkerIds.has(w.id));
  const deployableCount = matrix.filter((r) => r.deployable).length;

  if (!gang) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/workforce/gangs')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{gang.name}</h1>
          <p className="text-xs text-muted-foreground">{gang.base_postcode || 'No base'}{gang.usual_day_rate ? ` · £${gang.usual_day_rate}/day` : ''}</p>
        </div>
        <Badge variant="secondary">{members.length} member{members.length === 1 ? '' : 's'}</Badge>
      </div>

      {/* Members */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Members</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 && <p className="text-xs text-muted-foreground">No members yet.</p>}
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <Link to={`/workforce/workers/${m.worker_id}`} className="font-medium hover:underline">
                  {m.worker?.full_name ?? 'Worker'}
                </Link>
                <span className="ml-2 text-xs capitalize text-muted-foreground">· {m.role}</span>
                {m.worker?.primary_trade && <span className="ml-1 text-xs text-muted-foreground">· {m.worker.primary_trade}</span>}
              </div>
              <button onClick={() => removeMember(m.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove member">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <form onSubmit={addMember} className="flex flex-wrap gap-2 pt-1">
            <select
              className="h-9 min-w-48 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={pick.worker_id}
              onChange={(e) => setPick({ ...pick, worker_id: e.target.value })}
            >
              <option value="">Add a worker…</option>
              {addable.map((w) => <option key={w.id} value={w.id}>{w.full_name}{w.primary_trade ? ` (${w.primary_trade})` : ''}</option>)}
            </select>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm capitalize" value={pick.role} onChange={(e) => setPick({ ...pick, role: e.target.value })}>
              <option value="leader">leader</option>
              <option value="permanent">permanent</option>
              <option value="reserve">reserve</option>
            </select>
            <Button type="submit" size="sm" disabled={busy || !pick.worker_id} className="gap-1.5"><Plus size={14} /> Add</Button>
          </form>
        </CardContent>
      </Card>

      {/* Compliance matrix */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Compliance matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reqs">Required cards / qualifications (comma separated — RTW always checked)</Label>
            <Input id="reqs" value={reqInput} onChange={(e) => setReqInput(e.target.value)} placeholder="CSCS, CPCS, SSSTS, Medical" />
          </div>

          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add members to see their compliance.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3 font-medium">Worker</th>
                      {requirements.map((r) => <th key={r} className="px-2 py-2 text-center font-medium">{r}</th>)}
                      <th className="px-2 py-2 text-center font-medium">Deployable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row) => (
                      <tr key={row.workerId} className="border-b last:border-0">
                        <td className="py-2 pr-3">{row.name}</td>
                        {requirements.map((r) => (
                          <td key={r} className="px-2 py-2 text-center" title={CELL[row.cells[r]].label}>
                            <span className="inline-flex justify-center">{CELL[row.cells[r]].icon}</span>
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center">
                          {row.deployable
                            ? <ShieldCheck size={15} className="mx-auto text-green-600" />
                            : <X size={15} className="mx-auto text-red-600" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                {deployableCount} of {matrix.length} member{matrix.length === 1 ? '' : 's'} meet every mandatory requirement.
                A missing mandatory item (✕) blocks deployment — safety-critical items must not be ordinarily overridden.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
