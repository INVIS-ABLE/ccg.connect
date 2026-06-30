/**
 * Performance & quality reviews for completed assignments.
 *
 * GUARDRAILS (non-negotiable, per the brief): this is NOT a secret automated
 * blacklist. A poor score requires an evidenced reason, the register is
 * restricted to ops, and every review is appealable. Scores inform human
 * decisions — they never auto-exclude a worker.
 */

export const REVIEW_DIRECTIONS = ['client_on_worker', 'worker_on_site'] as const;
export type ReviewDirection = (typeof REVIEW_DIRECTIONS)[number];

export const isReviewDirection = (v: unknown): v is ReviewDirection =>
  typeof v === 'string' && (REVIEW_DIRECTIONS as readonly string[]).includes(v);

export interface Dimension {
  key: string;
  label: string;
}

/** Score dimensions per direction (each rated 1..5). */
export const PERFORMANCE_DIMENSIONS: Record<ReviewDirection, Dimension[]> = {
  client_on_worker: [
    { key: 'attendance', label: 'Attendance' },
    { key: 'punctuality', label: 'Punctuality' },
    { key: 'productivity', label: 'Productivity' },
    { key: 'quality', label: 'Quality of work' },
    { key: 'safety', label: 'Safety behaviour' },
    { key: 'communication', label: 'Communication' },
    { key: 'teamwork', label: 'Teamwork' },
  ],
  worker_on_site: [
    { key: 'site_organisation', label: 'Site organisation' },
    { key: 'assignment_accuracy', label: 'Accuracy of assignment info' },
    { key: 'treatment', label: 'Treatment on site' },
    { key: 'welfare', label: 'Welfare facilities' },
    { key: 'safety', label: 'Safety' },
    { key: 'hours_accuracy', label: 'Hours accuracy' },
    { key: 'payment_accuracy', label: 'Payment accuracy' },
  ],
};

/** A score of 1 or 2 on any dimension is "poor" and must be evidenced. */
export const POOR_SCORE_THRESHOLD = 2;

type Scores = Record<string, number>;

/** Mean of the present 1..5 scores, rounded to 0.1; null if none. */
export function averageScore(scores: Scores): number | null {
  const vals = Object.values(scores).filter((n) => typeof n === 'number' && n >= 1 && n <= 5);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/** Every provided score must be an integer 1..5 (else the review is rejected). */
export function isValidScores(scores: unknown): scores is Scores {
  if (!scores || typeof scores !== 'object') return false;
  return Object.values(scores as Record<string, unknown>).every(
    (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5,
  );
}

/** True when any dimension is poor — evidence is then required before saving. */
export function requiresEvidence(scores: Scores): boolean {
  return Object.values(scores).some((n) => typeof n === 'number' && n <= POOR_SCORE_THRESHOLD);
}

export const PERFORMANCE_GUARDRAIL =
  'Reviews inform decisions but never auto-exclude a worker. A poor score needs an ' +
  'evidenced reason, and the worker can dispute it.';
