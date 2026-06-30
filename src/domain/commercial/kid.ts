/**
 * Key Information Document (KID) — owed to agency workers when CCG acts as an
 * employment business.
 *
 * SCOPE / LEGAL: this module models the *facts* a KID records and the document
 * lifecycle. It deliberately does NOT determine tax or employment status, and
 * the prefilled wording below is a starting draft only — the template MUST be
 * reviewed and approved by an employment-law specialist before it is issued to a
 * real worker. Treat `isKidComplete` as an editorial check, not legal sufficiency.
 */

export const KID_STATUSES = ['draft', 'issued', 'acknowledged', 'superseded'] as const;
export type KidStatus = (typeof KID_STATUSES)[number];

export const isKidStatus = (v: unknown): v is KidStatus =>
  typeof v === 'string' && (KID_STATUSES as readonly string[]).includes(v);

/** Shown prominently in the editor until the template is signed off. */
export const KID_LEGAL_NOTICE =
  'Draft template — the wording of a Key Information Document must be reviewed and ' +
  'approved by an employment-law specialist before it is issued. This tool records ' +
  'facts for that review; it does not determine tax or employment status.';

/** The facts a KID is expected to state (editorial completeness, not legal advice). */
export const KID_REQUIRED_FIELDS = [
  'employment_business',
  'contract_type',
  'paid_by',
  'pay_rate',
  'pay_frequency',
  'deductions',
  'holiday_entitlement',
] as const;

export interface KidFields {
  employment_business?: string | null;
  contract_type?: string | null;
  payment_model?: string | null;
  pay_rate?: number | null;
  pay_frequency?: string | null;
  paid_by?: string | null;
  deductions?: string | null;
  holiday_entitlement?: string | null;
  holiday_pay?: string | null;
  other_fees?: string | null;
  example_calculation?: string | null;
  notes?: string | null;
}

/** Which expected fields are still blank — drives an "incomplete" hint before issue. */
export function missingKidFields(kid: KidFields): string[] {
  return KID_REQUIRED_FIELDS.filter((f) => {
    const v = kid[f];
    return v == null || (typeof v === 'string' && v.trim() === '') || (f === 'pay_rate' && !v);
  });
}

export const isKidComplete = (kid: KidFields): boolean => missingKidFields(kid).length === 0;

const PAID_BY: Record<string, string> = {
  paye: 'The employment business (PAYE)',
  cis: 'The employment business under CIS (subject to verification)',
  umbrella: 'An umbrella company',
  limited: "The worker's own limited company",
};

const CONTRACT_TYPE: Record<string, string> = {
  paye: 'Contract of employment / worker contract with the employment business',
  cis: 'Contract for services (CIS subcontractor)',
  umbrella: 'Contract via an umbrella company',
  limited: 'Contract for services via a limited company (PSC)',
};

/**
 * A starting draft for a new KID, prefilled from what we know. Every value is a
 * placeholder for ops to confirm/replace — nothing here is legal wording.
 */
export function defaultKid(input: {
  employmentBusiness?: string;
  paymentModel?: string | null;
  payRate?: number | null;
}): KidFields {
  const model = input.paymentModel ?? '';
  return {
    employment_business: input.employmentBusiness ?? 'Cook Construction Growth',
    contract_type: CONTRACT_TYPE[model] ?? '',
    payment_model: model || null,
    pay_rate: input.payRate ?? null,
    pay_frequency: 'Weekly',
    paid_by: PAID_BY[model] ?? '',
    deductions:
      model === 'paye'
        ? 'PAYE income tax and National Insurance; pension (auto-enrolment) where eligible.'
        : 'To be confirmed by payroll — depends on the payment model. Professional review required.',
    holiday_entitlement: '5.6 weeks pro-rata (statutory minimum).',
    holiday_pay: 'Accrued and paid in line with statutory entitlement.',
    other_fees: '',
    example_calculation: '',
    notes: '',
  };
}
