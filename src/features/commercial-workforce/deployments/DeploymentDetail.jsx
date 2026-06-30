import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, AlertTriangle, X, ShieldCheck, MessageSquare, CheckCircle2, FileText, Receipt, UserCog, QrCode } from 'lucide-react';
import { DeploymentTimesheets } from './DeploymentTimesheets';
import { DeploymentRollCall } from './DeploymentRollCall';
import { DeploymentDiary } from './DeploymentDiary';
import { DeploymentDocuments } from './DeploymentDocuments';
import { ReplacementDialog } from './ReplacementDialog';
import { SiteCheckInQrDialog } from './SiteCheckInQrDialog';

const gbp = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);

const CELL = {
  ok: <Check size={14} className="text-green-600" />,
  warning: <AlertTriangle size={14} className="text-amber-600" />,
  missing: <X size={14} className="text-red-600" />,
};
const NEXT = { proposed: ['cancelled'], confirmed: ['active', 'cancelled'], active: ['completed', 'cancelled'] };

export default function DeploymentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invoiceMsg, setInvoiceMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(async () => {
    const [r, inv] = await Promise.all([
      api.deployments.get(id).catch(() => null),
      api.commercialInvoices.list(id).catch(() => ({ invoices: [] })),
    ]);
    if (r) setData(r);
    setInvoices(inv.invoices ?? []);
  }, [id]);

  async function generateInvoice() {
    setBusy(true);
    setInvoiceMsg(null);
    try {
      await api.commercialInvoices.generate(id);
      await load();
    } catch (err) {
      setInvoiceMsg(err?.body?.error === 'no_locked_timesheets' ? 'No locked timesheets to invoice — approve and lock timesheets first.' : 'Could not generate invoice.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [load]);

  async function confirm() {
    setBusy(true);
    try {
      await api.deployments.confirm(id);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function setStatus(status) {
    setBusy(true);
    try {
      await api.deployments.update(id, { status });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { deployment: d, request, requirements, members, compliance } = data;
  const allDeployable = compliance.length > 0 && compliance.every((r) => r.deployable);
  const moves = NEXT[d.status] ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/workforce/deployments')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{request?.title ?? 'Deployment'}</h1>
          <p className="text-xs text-muted-foreground">
            {members.length} worker{members.length === 1 ? '' : 's'}{d.start_date ? ` · from ${d.start_date}` : ''}
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">{d.status}</Badge>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          {d.status === 'proposed' && (
            <Button size="sm" disabled={busy || members.length === 0} onClick={confirm} className="gap-1.5">
              <CheckCircle2 size={15} /> {busy ? 'Confirming…' : 'Confirm deployment'}
            </Button>
          )}
          {moves.map((s) => (
            <Button key={s} size="sm" variant={s === 'cancelled' ? 'outline' : 'default'} disabled={busy} onClick={() => setStatus(s)} className="capitalize">
              {s === 'active' ? 'Mark active' : s === 'completed' ? 'Mark completed' : s}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setQrOpen(true)} className="ml-auto gap-1.5">
            <QrCode size={14} /> Check-in QR
          </Button>
          {d.conversation_id && (
            <Link to="/messages">
              <Button size="sm" variant="outline" className="gap-1.5"><MessageSquare size={14} /> Site chat</Button>
            </Link>
          )}
          {d.confirmed_at && (
            <span className="text-xs text-muted-foreground">Compliance snapshot frozen {new Date(d.confirmed_at).toLocaleString('en-GB')}.</span>
          )}
        </CardContent>
      </Card>

      {/* Workers */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Workers</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 && <p className="text-xs text-muted-foreground">No workers on this deployment.</p>}
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <Link to={`/workforce/workers/${m.worker_id}`} className="font-medium hover:underline">{m.worker?.full_name ?? 'Worker'}</Link>
                {m.worker?.primary_trade && <span className="ml-2 text-xs text-muted-foreground">· {m.worker.primary_trade}</span>}
              </div>
              {m.role && <span className="text-xs capitalize text-muted-foreground">{m.role}</span>}
              {d.status !== 'completed' && d.status !== 'cancelled' && (
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setReplacing(m)}>
                  <UserCog size={13} /> Replace
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Compliance {d.confirmed_at ? '(live)' : '(pre-deployment)'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {compliance.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add workers to evaluate compliance.</p>
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
                    {compliance.map((row) => (
                      <tr key={row.workerId} className="border-b last:border-0">
                        <td className="py-2 pr-3">{row.name}</td>
                        {requirements.map((r) => <td key={r} className="px-2 py-2 text-center"><span className="inline-flex justify-center">{CELL[row.cells[r]]}</span></td>)}
                        <td className="px-2 py-2 text-center">{row.deployable ? <ShieldCheck size={15} className="mx-auto text-green-600" /> : <X size={15} className="mx-auto text-red-600" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!allDeployable && d.status === 'proposed' && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={13} /> Some workers have a missing mandatory requirement. Resolve before confirming — safety-critical items must not be ordinarily overridden.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Roll call / attendance */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Roll call &amp; attendance</CardTitle></CardHeader>
        <CardContent>
          <DeploymentRollCall deploymentId={d.id} members={members} />
        </CardContent>
      </Card>

      {/* Site diary */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Site diary</CardTitle></CardHeader>
        <CardContent>
          <DeploymentDiary deploymentId={d.id} />
        </CardContent>
      </Card>

      {/* RAMS / Method statements */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">RAMS &amp; method statements</CardTitle></CardHeader>
        <CardContent>
          <DeploymentDocuments deploymentId={d.id} siteName={request?.title ?? ''} />
        </CardContent>
      </Card>

      {/* Time & pay */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Time &amp; pay</CardTitle></CardHeader>
        <CardContent>
          <DeploymentTimesheets deploymentId={d.id} members={members} />
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><Receipt size={15} /> Client invoices</CardTitle>
          <Button size="sm" variant="outline" disabled={busy} onClick={generateInvoice} className="gap-1.5">
            <FileText size={14} /> Generate from locked timesheets
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoiceMsg && <p className="text-xs text-amber-700 dark:text-amber-400">{invoiceMsg}</p>}
          {invoices.length === 0 && <p className="text-xs text-muted-foreground">No invoices yet. Lock timesheets, then generate.</p>}
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{inv.invoice_number}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.period_start}{inv.period_end && inv.period_end !== inv.period_start ? ` – ${inv.period_end}` : ''} · net {gbp(inv.net_amount)} · VAT {gbp(inv.vat_amount)}
                </p>
              </div>
              <span className="font-semibold tabular-nums">{gbp(inv.gross_amount)}</span>
              <Badge variant="secondary" className="capitalize">{inv.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <ReplacementDialog
        deploymentId={d.id}
        worker={replacing}
        onClose={() => setReplacing(null)}
        onReplaced={load}
      />

      <SiteCheckInQrDialog
        deploymentId={d.id}
        siteName={request?.title ?? 'Site'}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    </div>
  );
}
