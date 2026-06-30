/**
 * Replacement candidate ranking. Pure — scores available workers against the
 * deployment's requirements (via the compliance matrix) so the best-fit, fully
 * compliant replacements surface first. Distance/availability can fold in later.
 */
import { complianceRow, type WorkerComplianceInput, type ComplianceRow } from '../workforce/compliance';

export interface RankedCandidate {
  workerId: string;
  name: string;
  compliance: ComplianceRow;
  /** Higher is better: deployable >> fewer missing >> fewer warnings. */
  score: number;
}

export function rankReplacementCandidates(
  candidates: readonly WorkerComplianceInput[],
  requirements: readonly string[],
  now: Date,
): RankedCandidate[] {
  return candidates
    .map((w) => {
      const compliance = complianceRow(w, requirements, now);
      const cells = Object.values(compliance.cells);
      const missing = cells.filter((s) => s === 'missing').length;
      const warning = cells.filter((s) => s === 'warning').length;
      const score = (compliance.deployable ? 1000 : 0) - missing * 100 - warning * 10;
      return { workerId: w.id, name: w.full_name, compliance, score };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
