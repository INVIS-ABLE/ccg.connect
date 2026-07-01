/**
 * Charge-rate build-up for a labour request (quote/rate-approval stage).
 *
 * Builds UP from the worker's hourly pay to a client charge rate, making every
 * layer explicit: employer on-costs (holiday, pension, employer NI, other),
 * pass-through allowances (travel, lodge) and the CCG agency margin, then the
 * VAT shown for reference. This is the inverse of payEngine.computeTimesheetPay,
 * which works from agreed rates back to margin on actual hours.
 *
 * Pure and penny-rounded. It encodes ARITHMETIC only — it never decides the
 * statutory on-cost percentages or the CIS/PAYE/VAT treatment; those are
 * planning assumptions passed in and confirmed by payroll/tax specialists.
 *
 * Conventions:
 *  - On-cost percentages apply to the worker pay rate (not compounded).
 *  - Pass-through allowances are recovered at cost — margin is NOT taken on them.
 *  - A percentage margin applies to the labour cost (pay + on-costs), not to
 *    pass-throughs. A fixed margin is a flat £/hr uplift.
 */

export const MARGIN_KINDS = ['percent', 'fixed'] as const;
export type MarginKind = (typeof MARGIN_KINDS)[number];

export const isMarginKind = (v: unknown): v is MarginKind =>
  typeof v === 'string' && (MARGIN_KINDS as readonly string[]).includes(v);

export interface RateBuildUpInput {
  /** Worker pay rate £/hr — the base of the build-up. */
  payRate: number;
  /** Employer on-costs as a percentage of pay. */
  holidayPct?: number;
  pensionPct?: number;
  employerNiPct?: number;
  /** Any other on-cost as a flat £/hr (e.g. apprenticeship levy, insurance). */
  otherOncostPerHour?: number;
  /** Pass-through allowances £/hr, recovered at cost. */
  travelPerHour?: number;
  lodgePerHour?: number;
  /** CCG agency margin. */
  marginKind?: MarginKind;
  marginValue?: number;
  /** VAT rate for the reference inc-VAT figure (e.g. 20). */
  vatRatePct?: number;
}

export interface BuildUpLine {
  label: string;
  amount: number;
}

export interface RateBuildUpResult {
  payRate: number;
  holidayCost: number;
  pensionCost: number;
  niCost: number;
  otherOncost: number;
  oncostTotal: number;
  /** Pay + on-costs. */
  labourCost: number;
  passThrough: number;
  /** Labour cost + pass-throughs — CCG's total cost per hour. */
  costBase: number;
  margin: number;
  /** Client charge £/hr, excluding VAT. */
  chargeExVat: number;
  vatAmount: number;
  chargeIncVat: number;
  /** Margin as a percentage of the ex-VAT charge (null when charge is 0). */
  marginPctOfCharge: number | null;
  /** Ordered lines for a transparent breakdown display. */
  breakdown: BuildUpLine[];
}

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const pos = (v: number | undefined) => (Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0);
const pct = (base: number, percentage: number | undefined) => base * (pos(percentage) / 100);

export function buildUpRate(input: RateBuildUpInput): RateBuildUpResult {
  const payRate = pos(input.payRate);

  const holidayCost = r2(pct(payRate, input.holidayPct));
  const pensionCost = r2(pct(payRate, input.pensionPct));
  const niCost = r2(pct(payRate, input.employerNiPct));
  const otherOncost = r2(pos(input.otherOncostPerHour));
  const oncostTotal = r2(holidayCost + pensionCost + niCost + otherOncost);

  const labourCost = r2(payRate + oncostTotal);
  const passThrough = r2(pos(input.travelPerHour) + pos(input.lodgePerHour));
  const costBase = r2(labourCost + passThrough);

  const margin =
    input.marginKind === 'fixed'
      ? r2(pos(input.marginValue))
      : r2(pct(labourCost, input.marginValue));

  const chargeExVat = r2(costBase + margin);
  const vatAmount = r2(chargeExVat * (pos(input.vatRatePct) / 100));
  const chargeIncVat = r2(chargeExVat + vatAmount);
  const marginPctOfCharge = chargeExVat > 0 ? r2((margin / chargeExVat) * 100) : null;

  const breakdown: BuildUpLine[] = [
    { label: 'Worker pay', amount: r2(payRate) },
    { label: 'Holiday', amount: holidayCost },
    { label: 'Pension', amount: pensionCost },
    { label: 'Employer NI', amount: niCost },
    { label: 'Other on-cost', amount: otherOncost },
    { label: 'Travel & lodge', amount: passThrough },
    { label: 'CCG margin', amount: margin },
  ].filter((l) => l.amount > 0);

  return {
    payRate: r2(payRate),
    holidayCost,
    pensionCost,
    niCost,
    otherOncost,
    oncostTotal,
    labourCost,
    passThrough,
    costBase,
    margin,
    chargeExVat,
    vatAmount,
    chargeIncVat,
    marginPctOfCharge,
    breakdown,
  };
}
