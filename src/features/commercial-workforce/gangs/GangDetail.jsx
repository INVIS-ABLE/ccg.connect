import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Check, AlertTriangle, X, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import { complianceMatrix, mergeRequirements, RTW_REQUIREMENT } from '@/domain/workforce/compliance';
import { computeGangRollup } from '@/domain/commercial/gangRollup';

const CELL = {
  ok: { icon: <Check size={14} className="text-green-600" />, label: 'OK' },
  warning: { icon: <AlertTriangle size={14} className="text-amber-600" />, label: 'Expiring' },
  missing: { icon: <X size={14} className="text-red-600" />, label: 'Missing' },
};

const fmtDate = (d) => (d ? new Date(d.length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

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

  const [candidates, setCandidates] = useState(null);
  const [loadingCands, setLoadingCands] = useState(false);
  async function findCandidates() {
    setLoadingCands(true);
    try {
      const r = await api.gangs.candidates(id, requirements.join(','));
      setCandidates(r.candidates ?? []);
    } finally {
      setLoadingCands(false);
    }
  }
  async function addCandidate(workerId) {
    await api.gangs.addMember(id, { worker_id: workerId, role: 'permanent' });
    await load();
    await findCandidates();
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

  const rollup = useMemo(
    () =>
      computeGangRollup(
        members
          .filter((m) => m.worker)
          .map((m) => ({
            role: m.role,
            right_to_work_status: m.worker.right_to_work_status,
            available_from: m.worker.available_from ?? null,
            day_rate: m.worker.day_rate ?? null,
            cards: m.worker.cards ?? [],
          })),
        gang?.usual_day_rate ?? null,
        now,
      ),
    [members, gang, now],
  );

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

      {/* Gang roll-up — combined quals, availability & cost/margin */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-sm"><Layers size={14} /> Gang roll-up</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border p-2.5">
              <p className="text-xs text-muted-foreground">Available now</p>
              <p className="text-lg font-semibold">{rollup.availableNow}<span className="text-sm text-muted-foreground">/{rollup.totalMembers}</span></p>
              {rollup.earliestAvailable && <p className="text-[11px] text-amber-600">rest from {fmtDate(rollup.earliestAvailable)}</p>}
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-xs text-muted-foreground">RTW valid</p>
              <p className="text-lg font-semibold">{rollup.rtwValid}<span className="text-sm text-muted-foreground">/{rollup.totalMembers}</span></p>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-xs text-muted-foreground">Pay cost / day</p>
              <p className="text-lg font-semibold">£{rollup.payCostPerDay}</p>
              <p className="text-[11px] text-muted-foreground">{rollup.coreMembers} core{rollup.reserveMembers ? ` · ${rollup.reserveMembers} reserve` : ''}</p>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-xs text-muted-foreground">Margin / day</p>
              {rollup.marginPerDay === null ? (
                <p className="text-sm text-muted-foreground">set charge rate</p>
              ) : (
                <p className={`text-lg font-semibold ${rollup.marginPerDay < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  £{rollup.marginPerDay}
                  {rollup.marginPct !== null && <span className="ml-1 text-xs font-normal text-muted-foreground">({rollup.marginPct}%)</span>}
                </p>
              )}
              {rollup.chargePerDay !== null && <p className="text-[11px] text-muted-foreground">charge £{rollup.chargePerDay}/day</p>}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Combined verified qualifications</p>
            {rollup.qualifications.length === 0 ? (
              <p className="text-xs text-muted-foreground">None verified yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {rollup.qualifications.map((q) => <Badge key={q} variant="secondary" className="font-normal">{q}</Badge>)}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pay cost covers the working core (leader + permanent); reserves are backups and aren&apos;t charged. Margin uses the gang&apos;s usual day rate as the client charge.
          </p>
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

      {/* Gang builder — rank available workers against the requirements above */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><Sparkles size={15} /> Gang builder</CardTitle>
          <Button size="sm" variant="outline" disabled={loadingCands} onClick={findCandidates}>
            {loadingCands ? 'Finding…' : 'Find available workers'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Ranks active workers not already in the gang against the requirements above — compliant &amp; ready first. Each is still checked individually.
          </p>
          {candidates === null && <p className="text-xs text-muted-foreground">Set the requirements above, then find available workers.</p>}
          {candidates?.length === 0 && <p className="text-xs text-muted-foreground">No other active workers to suggest.</p>}
          {candidates?.map((cand) => {
            const missing = Object.values(cand.compliance.cells).filter((v) => v === 'missing').length;
            const warnings = Object.values(cand.compliance.cells).filter((v) => v === 'warning').length;
            return (
              <div key={cand.workerId} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <Link to={`/workforce/workers/${cand.workerId}`} className="font-medium hover:underline">{cand.name}</Link>
                  <p className="mt-0.5 text-xs">
                    {cand.compliance.deployable
                      ? <span className="text-green-600">Ready{warnings ? ` · ${warnings} expiring` : ''}</span>
                      : <span className="text-red-600">{missing} missing{warnings ? ` · ${warnings} expiring` : ''}</span>}
                    {cand.available_now
                      ? <span className="text-muted-foreground"> · available now</span>
                      : <span className="text-amber-600"> · from {fmtDate(cand.available_from)}</span>}
                  </p>
                </div>
                <Button size="sm" variant={cand.compliance.deployable ? 'default' : 'outline'} className="gap-1.5" onClick={() => addCandidate(cand.workerId)}>
                  <Plus size={13} /> Add
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
