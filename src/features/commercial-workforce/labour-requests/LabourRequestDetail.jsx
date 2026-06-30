import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { nextStatuses, labourRequestStatusLabel } from '@/domain/commercial/labourRequestStatus';
import { isEmploymentModel, employmentModelInfo } from '@/domain/commercial/employmentModels';

function gbp(n) {
  return n == null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

export default function LabourRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [req, setReq] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.labourRequests.get(id).catch(() => null);
    if (r) setReq(r.request);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function advance(status) {
    setBusy(true);
    try {
      const r = await api.labourRequests.update(id, { status });
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
          <p className="text-xs capitalize text-muted-foreground">{req.urgency} urgency</p>
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

      <p className="text-xs text-muted-foreground">
        Next: deployment — match compliant, available workers/gangs to this request, confirm, and auto-create the site chat.
      </p>
    </div>
  );
}
