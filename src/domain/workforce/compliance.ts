/**
 * Compliance matrix: combine the requirements that apply to a deployment
 * (CCG minimum + client + site + trade/role + equipment) and evaluate each
 * worker against them. Pure — the caller unions the requirement sources and
 * passes the flat list; this decides per-worker ✓ / ⚠ / ✕ and whether the worker
 * is deployable.
 *
 * A gang grouping never substitutes for these per-operative checks (HSE expects
 * each worker competent, trained and verified). Safety-critical overrides are a
 * policy concern for the caller — this module only reports status.
 */
import { cardStatus, rightToWorkOk } from './cardStatus';

export type RequirementStatus = 'ok' | 'warning' | 'missing';

/** The special requirement representing a valid right-to-work check. */
export const RTW_REQUIREMENT = 'RTW';

export interface WorkerCardLike {
  card_type: string;
  expiry_date?: string | null;
}

export interface WorkerComplianceInput {
  id: string;
  full_name: string;
  right_to_work_status: 'unchecked' | 'checked' | 'expired' | 'restricted';
  rtw_expiry?: string | null;
  cards: readonly WorkerCardLike[];
}

export interface ComplianceRow {
  workerId: string;
  name: string;
  cells: Record<string, RequirementStatus>;
  /** True only when no requirement is outright missing (warnings are allowed). */
  deployable: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

/** A worker's status against a single requirement. */
export function requirementStatus(
  worker: WorkerComplianceInput,
  requirement: string,
  now: Date,
): RequirementStatus {
  if (norm(requirement) === norm(RTW_REQUIREMENT)) {
    return rightToWorkOk(worker.right_to_work_status, worker.rtw_expiry, now) ? 'ok' : 'missing';
  }
  let result: RequirementStatus = 'missing';
  for (const c of worker.cards) {
    if (norm(c.card_type) !== norm(requirement)) continue;
    const s = cardStatus(c.expiry_date, now);
    // 'none' = card present with no expiry recorded → treated as held.
    if (s === 'valid' || s === 'none') return 'ok';
    if (s === 'expiring') result = 'warning';
    // 'expired' leaves result as-is (missing unless another card matches better)
  }
  return result;
}

export function complianceRow(
  worker: WorkerComplianceInput,
  requirements: readonly string[],
  now: Date,
): ComplianceRow {
  const cells: Record<string, RequirementStatus> = {};
  for (const r of requirements) cells[r] = requirementStatus(worker, r, now);
  const deployable = Object.values(cells).every((s) => s !== 'missing');
  return { workerId: worker.id, name: worker.full_name, cells, deployable };
}

export function complianceMatrix(
  workers: readonly WorkerComplianceInput[],
  requirements: readonly string[],
  now: Date,
): ComplianceRow[] {
  return workers.map((w) => complianceRow(w, requirements, now));
}

/** Merge requirement sources into a de-duplicated, order-stable list. */
export function mergeRequirements(...sources: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of sources) {
    for (const r of list) {
      const key = norm(r);
      if (r.trim() && !seen.has(key)) {
        seen.add(key);
        out.push(r.trim());
      }
    }
  }
  return out;
}
