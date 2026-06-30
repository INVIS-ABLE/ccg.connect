/**
 * The three commercial service models CCG can supply. Recorded on every
 * commercial order because labour supply vs labour-only subcontracting can
 * attract different CIS, PAYE and VAT treatment (incl. the CIS domestic reverse
 * charge).
 *
 * IMPORTANT: this module describes the models and flags which need tax review.
 * It NEVER decides CIS/PAYE/VAT status automatically — HMRC distinguishes a
 * supply of staff from labour-only construction services on the facts, so the
 * app captures the choice and routes it to a professional for determination.
 */
export const EMPLOYMENT_MODELS = ['labour_supply', 'managed_workforce', 'subcontract_work_package'] as const;
export type EmploymentModel = (typeof EMPLOYMENT_MODELS)[number];

export interface EmploymentModelInfo {
  value: EmploymentModel;
  label: string;
  summary: string;
  /** Whether the model typically needs a professional CIS/VAT/PAYE determination. */
  taxReviewRequired: boolean;
}

const INFO: Record<EmploymentModel, EmploymentModelInfo> = {
  labour_supply: {
    value: 'labour_supply',
    label: 'Labour supply',
    summary: 'CCG supplies individual temporary workers or gangs; the client directs their daily work.',
    taxReviewRequired: true,
  },
  managed_workforce: {
    value: 'managed_workforce',
    label: 'Managed workforce',
    summary: 'CCG provides and manages the gang (rotas, replacements, attendance); the client controls site activities.',
    taxReviewRequired: true,
  },
  subcontract_work_package: {
    value: 'subcontract_work_package',
    label: 'Subcontract work package',
    summary: 'CCG (or its subcontractor) delivers a defined package of work to a price, with materials and supervision.',
    taxReviewRequired: true,
  },
};

export function isEmploymentModel(value: unknown): value is EmploymentModel {
  return typeof value === 'string' && (EMPLOYMENT_MODELS as readonly string[]).includes(value);
}

export function employmentModelInfo(value: EmploymentModel): EmploymentModelInfo {
  return INFO[value];
}

export function listEmploymentModels(): EmploymentModelInfo[] {
  return EMPLOYMENT_MODELS.map((m) => INFO[m]);
}

/**
 * The app must never auto-determine tax status — every model is flagged for
 * professional review. Returns true to make that explicit at call sites.
 */
export function requiresTaxReview(value: EmploymentModel): boolean {
  return INFO[value].taxReviewRequired;
}
