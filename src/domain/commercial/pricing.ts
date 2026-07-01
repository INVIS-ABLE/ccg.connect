/**
 * Dynamic pricing — apply surcharges to a base charge rate.
 *
 * Each surcharge is either a percentage uplift of the base rate or a fixed
 * per-unit addition (e.g. +£2/hr lodge). Percentages always apply to the base,
 * not compounded, so the breakdown is transparent and order-independent. Pure
 * and penny-rounded.
 */

export const SURCHARGE_KINDS = ['percent', 'fixed'] as const;
export type SurchargeKind = (typeof SURCHARGE_KINDS)[number];

export const isSurchargeKind = (v: unknown): v is SurchargeKind =>
  typeof v === 'string' && (SURCHARGE_KINDS as readonly string[]).includes(v);

export interface Surcharge {
  label: string;
  kind: SurchargeKind;
  value: number;
}

export interface PricedLine {
  label: string;
  kind: SurchargeKind;
  value: number;
  amount: number;
}

export interface PricingResult {
  base: number;
  effective: number;
  breakdown: PricedLine[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Effective rate = base + Σ surcharges (percentages applied to the base). */
export function applySurcharges(baseRate: number, surcharges: Surcharge[]): PricingResult {
  const base = r2(Number.isFinite(baseRate) ? baseRate : 0);
  const breakdown: PricedLine[] = surcharges.map((s) => {
    const amount = s.kind === 'percent' ? r2((base * (s.value || 0)) / 100) : r2(s.value || 0);
    return { label: s.label, kind: s.kind, value: s.value || 0, amount };
  });
  const effective = r2(base + breakdown.reduce((sum, b) => sum + b.amount, 0));
  return { base, effective, breakdown };
}
