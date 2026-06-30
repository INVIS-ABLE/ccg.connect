import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HardHat, Receipt, Users } from 'lucide-react';

const gbp = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);

const STATUS_TONE = {
  active: 'default',
  confirmed: 'secondary',
  completed: 'outline',
  proposed: 'secondary',
};

function fillLabel(d) {
  if (d.workers_required == null) return `${d.workers_assigned} on site`;
  return `${d.workers_assigned}/${d.workers_required} filled`;
}

/**
 * Client portal — read-only view of the agency labour supplied to the client's
 * own corporate account(s). Shows deployment fill status, dates and the client's
 * own invoices. The API only ever returns client-safe data (no rates, margins,
 * cost or worker identities).
 */
export default function ClientSiteWork() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api.portal
      .commercial()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  const invoiceTotal = useMemo(
    () => (data ? data.invoices.reduce((s, i) => s + (i.gross_amount || 0), 0) : 0),
    [data],
  );

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Site work</h1>
        <p className="text-sm text-destructive">Could not load your site work. Please try again later.</p>
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Site work</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (data.accounts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Site work</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No site work is shared with your account yet. If you expect to see deployments here, contact your CCG account manager.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Site work</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Labour supplied to {data.accounts.map((a) => a.name).join(', ')}.
        </p>
      </div>

      {/* Deployments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><HardHat size={15} /> Deployments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.deployments.length === 0 && <p className="text-sm text-muted-foreground">No active deployments.</p>}
          {data.deployments.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{d.request_title ?? 'Site labour'}</p>
                <p className="text-xs text-muted-foreground">
                  {d.site_name ?? 'Site'}
                  {d.start_date ? ` · from ${d.start_date}` : ''}
                  {d.finish_date ? ` to ${d.finish_date}` : ''}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users size={13} /> {fillLabel(d)}
              </span>
              <Badge variant={STATUS_TONE[d.status] ?? 'secondary'} className="capitalize">{d.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><Receipt size={15} /> Invoices</CardTitle>
          {data.invoices.length > 0 && <span className="text-xs text-muted-foreground">{gbp(invoiceTotal)} total</span>}
        </CardHeader>
        <CardContent className="space-y-2">
          {data.invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices issued yet.</p>}
          {data.invoices.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{inv.invoice_number ?? 'Invoice'}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.period_start}
                  {inv.period_end && inv.period_end !== inv.period_start ? ` – ${inv.period_end}` : ''}
                  {' · '}net {gbp(inv.net_amount)} · VAT {gbp(inv.vat_amount)}
                </p>
              </div>
              <span className="font-semibold tabular-nums">{gbp(inv.gross_amount)}</span>
              <Badge variant={inv.status === 'paid' ? 'outline' : 'secondary'} className="capitalize">{inv.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
