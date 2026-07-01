import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, Truck, Plus, ChevronRight, Calculator } from 'lucide-react';
import { nextStatuses, labourRequestStatusLabel } from '@/domain/commercial/labourRequestStatus';
import { isEmploymentModel, employmentModelInfo } from '@/domain/commercial/employmentModels';
import { isRequestType, requestTypeInfo } from '@/domain/commercial/requestTypes';
import { buildUpRate } from '@/domain/commercial/rateBuildUp';

function gbp(n) {
  return n == null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

export default function LabourRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [req, setReq] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deps, setDeps] = useState([]);
  const [gangs, setGangs] = useState([]);
  const [gangId, setGangId] = useState('');
  // Rate build-up inputs — planning assumptions the ops user can tune. Defaults
  // are common UK starting points (12.07% rolled-up holiday), not determinations.
  const [rb, setRb] = useState({
    payRate: '', holidayPct: '12.07', pensionPct: '3', employerNiPct: '0',
    otherOncostPerHour: '', travelPerHour: '', lodgePerHour: '',
    marginKind: 'percent', marginValue: '15', vatRatePct: '20',
  });

  const load = useCallback(async () => {
    const [r, dp, gs] = await Promise.all([
      api.labourRequests.get(id).catch(() => null),
      api.deployments.list(id).catch(() => ({ deployments: [] })),
      api.gangs.list().catch(() => ({ gangs: [] })),
    ]);
    if (r) {
      setReq(r.request);
      if (r.request.rate_offered != null) setRb((s) => ({ ...s, payRate: String(r.request.rate_offered) }));
    }
    setDeps(dp.deployments ?? []);
    setGangs(gs.gangs ?? []);
  }, [id]);

  const num = (v) => (v === '' || v == null ? 0 : parseFloat(v) || 0);
  const rbResult = useMemo(
    () =>
      buildUpRate({
        payRate: num(rb.payRate),
        holidayPct: num(rb.holidayPct),
        pensionPct: num(rb.pensionPct),
        employerNiPct: num(rb.employerNiPct),
        otherOncostPerHour: num(rb.otherOncostPerHour),
        travelPerHour: num(rb.travelPerHour),
        lodgePerHour: num(rb.lodgePerHour),
        marginKind: rb.marginKind === 'fixed' ? 'fixed' : 'percent',
        marginValue: num(rb.marginValue),
        vatRatePct: num(rb.vatRatePct),
      }),
    [rb],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function createDeployment() {
    setBusy(true);
    try {
      const r = await api.deployments.create({ labour_request_id: id, gang_id: gangId || undefined });
      navigate(`/workforce/deployments/${r.deployment.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function advance(status) {
    setBusy(true);
    try {
      const r = await api.labourRequests.update(id, { status });
      setReq(r.request);
    } finally {
      setBusy(false);
    }
  }

  async function saveRates() {
    setBusy(true);
    try {
      const r = await api.labourRequests.update(id, {
        rate_offered: num(rb.payRate),
        charge_rate: rbResult.chargeExVat,
      });
      setReq(r.request);
    } finally {
      setBusy(false);
    }
  }

  if (!req) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const model = isEmploymentModel(req.employment_model) ? employmentModelInfo(req.employment_model) : null;
  const facts = [
    ['Trade', req.trade],
    ['Number required', req.number_required],
    ['Gang composition', req.gang_composition],
    ['Start', req.start_date],
    ['Finish', req.finish_date],
    ['Shift', req.shift_pattern],
    ['Min. qualifications', req.minimum_qualifications],
    ['Experience', req.experience_required],
    ['Pay rate', req.rate_offered != null ? `${gbp(req.rate_offered)}/hr` : null],
    ['Charge rate', req.charge_rate != null ? `${gbp(req.charge_rate)}/hr` : null],
    ['Overtime', req.overtime_rate != null ? `${gbp(req.overtime_rate)}/hr` : null],
    ['Travel/lodge', req.travel_lodge_allowance],
    ['PO number', req.po_number],
    ['Replacement SLA', req.replacement_sla],
  ].filter(([, v]) => v != null && v !== '');

  const moves = nextStatuses(req.status);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/workforce/requests')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{req.title}</h1>
          <p className="text-xs capitalize text-muted-foreground">
            {isRequestType(req.request_type) ? `${requestTypeInfo(req.request_type).label} · ` : ''}{req.urgency} urgency
          </p>
        </div>
        <Badge variant="secondary">{labourRequestStatusLabel(req.status)}</Badge>
      </div>

      {/* Status pipeline */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Status</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Current: <span className="font-medium text-foreground">{labourRequestStatusLabel(req.status)}</span></span>
          {moves.length === 0 ? (
            <span className="text-xs text-muted-foreground">— no further transitions</span>
          ) : (
            moves.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === 'cancelled' ? 'outline' : 'default'}
                disabled={busy}
                onClick={() => advance(s)}
              >
                {labourRequestStatusLabel(s)}
              </Button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Employment model + tax note */}
      {model && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Employment model</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{model.label}</p>
            <p className="text-sm text-muted-foreground">{model.summary}</p>
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              CIS / PAYE / VAT treatment depends on the actual arrangement — this is captured for professional review and is never auto-determined.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Request details</CardTitle></CardHeader>
        <CardContent className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {facts.length === 0 && <p className="text-xs text-muted-foreground">No further details recorded.</p>}
          {facts.map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}: </span><span>{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rate build-up: pay → on-costs → margin → client charge */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Calculator size={15} /> Rate build-up</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-xs">Worker pay £/hr</Label><Input type="number" step="0.01" inputMode="decimal" value={rb.payRate} onChange={(e) => setRb({ ...rb, payRate: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Holiday %</Label><Input type="number" step="0.01" inputMode="decimal" value={rb.holidayPct} onChange={(e) => setRb({ ...rb, holidayPct: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Pension %</Label><Input type="number" step="0.01" inputMode="decimal" value={rb.pensionPct} onChange={(e) => setRb({ ...rb, pensionPct: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Employer NI %</Label><Input type="number" step="0.01" inputMode="decimal" value={rb.employerNiPct} onChange={(e) => setRb({ ...rb, employerNiPct: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Other on-cost £/hr</Label><Input type="number" step="0.01" inputMode="decimal" value={rb.otherOncostPerHour} onChange={(e) => setRb({ ...rb, otherOncostPerHour: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">VAT %</Label><Input type="number" step="0.01" inputMode="decimal" value={rb.vatRatePct} onChange={(e) => setRb({ ...rb, vatRatePct: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Travel £/hr</Label><Input type="number" step="0.01" inputMode="decimal" value={rb.travelPerHour} onChange={(e) => setRb({ ...rb, travelPerHour: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Lodge £/hr</Label><Input type="number" step="0.01" inputMode="decimal" value={rb.lodgePerHour} onChange={(e) => setRb({ ...rb, lodgePerHour: e.target.value })} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Margin</Label>
              <div className="flex gap-1.5">
                <Input type="number" step="0.01" inputMode="decimal" value={rb.marginValue} onChange={(e) => setRb({ ...rb, marginValue: e.target.value })} />
                <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={rb.marginKind} onChange={(e) => setRb({ ...rb, marginKind: e.target.value })} aria-label="Margin type">
                  <option value="percent">%</option>
                  <option value="fixed">£/hr</option>
                </select>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <tbody>
                {rbResult.breakdown.map((l) => (
                  <tr key={l.label} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">{l.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{gbp(l.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/40 font-medium">
                  <td className="px-3 py-2">Charge rate (ex VAT)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{gbp(rbResult.chargeExVat)}/hr</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Cost/hr <span className="font-medium text-foreground">{gbp(rbResult.costBase)}</span></span>
            <span>Margin <span className="font-medium text-foreground">{gbp(rbResult.margin)}</span>{rbResult.marginPctOfCharge != null ? ` (${rbResult.marginPctOfCharge}%)` : ''}</span>
            <span>Inc VAT <span className="font-medium text-foreground">{gbp(rbResult.chargeIncVat)}/hr</span></span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={saveRates} disabled={busy || num(rb.payRate) <= 0}>Save pay &amp; charge rate</Button>
            <p className="text-xs text-muted-foreground">
              On-cost %s are planning assumptions — actual statutory rates and CIS/PAYE/VAT treatment are set by payroll/tax, never auto-determined. Client approval of the charge rate is recorded via the status pipeline above.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Deployments */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Truck size={15} /> Deployments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {deps.length === 0 && <p className="text-xs text-muted-foreground">No deployments yet.</p>}
          {deps.map((d) => (
            <Link key={d.id} to={`/workforce/deployments/${d.id}`} className="flex items-center gap-2 rounded-md border p-2.5 text-sm hover:bg-muted">
              <Truck size={15} className="text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{d.start_date ? `From ${d.start_date}` : 'Deployment'}</span>
              <Badge variant="outline" className="capitalize">{d.status}</Badge>
              <ChevronRight size={15} className="text-muted-foreground" />
            </Link>
          ))}
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <select className="h-9 min-w-48 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={gangId} onChange={(e) => setGangId(e.target.value)}>
              <option value="">Empty deployment (add workers later)</option>
              {gangs.map((g) => <option key={g.id} value={g.id}>Gang: {g.name}</option>)}
            </select>
            <Button size="sm" disabled={busy} onClick={createDeployment} className="gap-1.5"><Plus size={14} /> New deployment</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pick a gang to pre-fill its members, then confirm on the deployment to freeze compliance and auto-create the site chat.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
