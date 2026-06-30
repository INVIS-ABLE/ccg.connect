/**
 * Client-facing projections for the commercial portal.
 *
 * Security-critical: these are ALLOWLISTS BY CONSTRUCTION. Each function builds
 * its output from named fields only, so sensitive data (pay/charge rates,
 * margins, on-costs, worker PII, compliance/RTW, internal notes) can never leak
 * to a client even if the underlying row gains new columns. The portal API must
 * pass everything client-bound through these.
 *
 * A client sees their own deployments' fill status and dates, and their own
 * invoices' headline amounts (they are the payer) — but never the cost side or
 * who specifically is on site (named rosters require a separate, explicit
 * client-visibility decision, defaulting to private per the invariants).
 */

export interface RawDeployment {
  id: string;
  status: string;
  start_date: string | null;
  finish_date: string | null;
  account_id?: string | null;
  site_id?: string | null;
}

export interface PortalDeployment {
  id: string;
  status: string;
  start_date: string | null;
  finish_date: string | null;
  site_name: string | null;
  request_title: string | null;
  /** How many operatives the request asked for (null if unknown). */
  workers_required: number | null;
  /** How many are currently assigned (a count only — never identities). */
  workers_assigned: number;
}

export function toPortalDeployment(
  d: RawDeployment,
  extra: { site_name?: string | null; request_title?: string | null; workers_required?: number | null; workers_assigned?: number },
): PortalDeployment {
  return {
    id: d.id,
    status: d.status,
    start_date: d.start_date ?? null,
    finish_date: d.finish_date ?? null,
    site_name: extra.site_name ?? null,
    request_title: extra.request_title ?? null,
    workers_required: extra.workers_required ?? null,
    workers_assigned: extra.workers_assigned ?? 0,
  };
}

export interface RawInvoice {
  id: string;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  status: string;
}

export interface PortalInvoice {
  id: string;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  status: string;
}

/** Only the client's own invoices, and only once issued (drafts stay internal). */
export function isClientVisibleInvoice(i: { status: string }): boolean {
  return i.status === 'issued' || i.status === 'paid';
}

export function toPortalInvoice(i: RawInvoice): PortalInvoice {
  return {
    id: i.id,
    invoice_number: i.invoice_number ?? null,
    period_start: i.period_start ?? null,
    period_end: i.period_end ?? null,
    net_amount: i.net_amount ?? 0,
    vat_amount: i.vat_amount ?? 0,
    gross_amount: i.gross_amount ?? 0,
    status: i.status,
  };
}
