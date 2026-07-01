/**
 * Materials / plant / consumables on a deployment.
 *
 * Money model (pure, penny-rounded):
 *  - cost   = supplier unit cost × quantity ISSUED (what CCG procured/paid for)
 *  - charge = client unit charge × quantity BILLABLE, and only when chargeable
 *  - margin = charge − cost
 * Billable quantity is what was actually consumed: `used_qty` if recorded,
 * otherwise issued − returned. Cost/charge/margin are internal (never shown to
 * the client except the charge on their own chargeable lines).
 */

export const MATERIAL_CATEGORIES = [
  'material', 'tool', 'plant', 'ppe', 'vehicle', 'hired_equipment', 'fuel', 'consumable', 'other',
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const isMaterialCategory = (v: unknown): v is MaterialCategory =>
  typeof v === 'string' && (MATERIAL_CATEGORIES as readonly string[]).includes(v);

export interface MaterialLine {
  planned_qty?: number | null;
  issued_qty?: number | null;
  used_qty?: number | null;
  returned_qty?: number | null;
  lost_qty?: number | null;
  supplier_cost?: number | null;
  client_charge?: number | null;
  chargeable?: boolean | null;
}

export interface MaterialTotals {
  billableQty: number;
  cost: number;
  charge: number;
  margin: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Quantity actually consumed: used_qty if recorded, else issued − returned (≥0). */
export function billableQty(line: MaterialLine): number {
  if (line.used_qty != null) return Math.max(0, n(line.used_qty));
  return Math.max(0, n(line.issued_qty) - n(line.returned_qty));
}

export function materialTotals(line: MaterialLine): MaterialTotals {
  const billable = billableQty(line);
  const cost = r2(n(line.supplier_cost) * n(line.issued_qty));
  const charge = line.chargeable === false ? 0 : r2(n(line.client_charge) * billable);
  return { billableQty: billable, cost, charge, margin: r2(charge - cost) };
}

/** Roll a set of material lines into deployment totals. */
export function rollupMaterials(lines: MaterialLine[]): { count: number; cost: number; charge: number; margin: number } {
  let cost = 0, charge = 0;
  for (const l of lines) {
    const t = materialTotals(l);
    cost += t.cost;
    charge += t.charge;
  }
  return { count: lines.length, cost: r2(cost), charge: r2(charge), margin: r2(charge - cost) };
}
