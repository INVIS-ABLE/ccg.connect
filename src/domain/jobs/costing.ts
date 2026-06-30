/**
 * Job cost breakdown — materials line items + labour into a total.
 *
 * Pure and defensive (handles strings/blanks/negatives from form inputs) so the
 * job costing UI and any server-side use share one source of truth.
 */
export interface MaterialLine {
  description?: string;
  qty?: number | string;
  unit_cost?: number | string;
}

export interface CostBreakdown {
  materialsCost: number;
  labourCost: number;
  total: number;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Subtotal for a single material line (qty × unit cost, never negative). */
export function lineTotal(line: MaterialLine): number {
  return num(line.qty) * num(line.unit_cost);
}

export function jobCostBreakdown(materials: readonly MaterialLine[], labourCost: unknown): CostBreakdown {
  const materialsCost = materials.reduce((sum, l) => sum + lineTotal(l), 0);
  const labour = num(labourCost);
  return { materialsCost, labourCost: labour, total: materialsCost + labour };
}

/** Parse the JSON `materials` column into a line array, tolerating bad/empty data. */
export function parseMaterials(raw: string | null | undefined): MaterialLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MaterialLine[]) : [];
  } catch {
    return [];
  }
}
