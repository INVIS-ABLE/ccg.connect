import { describe, it, expect } from 'vitest';
import { toPortalDeployment, toPortalInvoice, isClientVisibleInvoice } from './portal';

const FORBIDDEN = ['pay_rate', 'charge_rate', 'oncost_rate', 'margin', 'workerPay', 'employerCost', 'cost', 'restricted_notes', 'notes'];

describe('toPortalDeployment', () => {
  it('exposes only the safe fill/date fields', () => {
    // A raw row deliberately carrying sensitive extras that must NOT pass through.
    const raw = { id: 'd1', status: 'active', start_date: '2026-07-01', finish_date: null, account_id: 'a1', pay_rate: 25, charge_rate: 40, margin: 15 } as never;
    const out = toPortalDeployment(raw, { site_name: 'Site A', request_title: 'Groundworks', workers_required: 5, workers_assigned: 4 });
    expect(out).toEqual({
      id: 'd1', status: 'active', start_date: '2026-07-01', finish_date: null,
      site_name: 'Site A', request_title: 'Groundworks', workers_required: 5, workers_assigned: 4,
    });
    for (const k of FORBIDDEN) expect(out).not.toHaveProperty(k);
  });

  it('defaults missing extras safely (never identities, assigned defaults to 0)', () => {
    const out = toPortalDeployment({ id: 'd2', status: 'proposed', start_date: null, finish_date: null }, {});
    expect(out.workers_required).toBeNull();
    expect(out.workers_assigned).toBe(0);
    expect(out.site_name).toBeNull();
  });
});

describe('toPortalInvoice', () => {
  it('exposes only headline amounts the payer should see', () => {
    const raw = { id: 'i1', invoice_number: 'INV-1', period_start: '2026-06-01', period_end: '2026-06-30', net_amount: 1000, vat_amount: 200, gross_amount: 1200, status: 'issued', line_items: 'SENSITIVE', notes: 'internal' } as never;
    const out = toPortalInvoice(raw);
    expect(out).toEqual({ id: 'i1', invoice_number: 'INV-1', period_start: '2026-06-01', period_end: '2026-06-30', net_amount: 1000, vat_amount: 200, gross_amount: 1200, status: 'issued' });
    expect(out).not.toHaveProperty('line_items');
    expect(out).not.toHaveProperty('notes');
  });
});

describe('isClientVisibleInvoice', () => {
  it('shows issued and paid, hides draft and cancelled', () => {
    expect(isClientVisibleInvoice({ status: 'issued' })).toBe(true);
    expect(isClientVisibleInvoice({ status: 'paid' })).toBe(true);
    expect(isClientVisibleInvoice({ status: 'draft' })).toBe(false);
    expect(isClientVisibleInvoice({ status: 'cancelled' })).toBe(false);
  });
});
