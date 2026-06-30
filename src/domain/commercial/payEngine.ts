/**
 * Rate / margin engine for commercial timesheets.
 *
 * Pure and penny-rounded. Computes worker pay, employer on-cost, client charge
 * and the CCG margin from hours + rates. The margin is sensitive and shown only
 * to authorised CCG users (enforced by the caller / API).
 *
 * This encodes ARITHMETIC only — it does not decide CIS/PAYE/VAT status or
 * statutory on-cost rates; those are configured per worker model by payroll/tax
 * specialists and passed in.
 */
export interface PayInput {
  basicHours: number;
  overtimeHours?: number;
  /** Worker pay rate £/hr. */
  payRate: number;
  /** Client charge rate £/hr. */
  chargeRate: number;
  /** Employer on-cost £/hr (NI, holiday, pension, apprenticeship levy, …). */
  oncostRate?: number;
  /** Overtime multiplier applied to both pay and charge (default 1.5). */
  overtimeMultiplier?: number;
  /** Pass-through amounts (added to both worker pay and client charge). */
  travel?: number;
  lodge?: number;
  expenses?: number;
  /** Deductions from worker pay only. */
  deductions?: number;
}

export interface PayResult {
  totalHours: number;
  payBasic: number;
  payOvertime: number;
  /** Total paid to the worker (incl. pass-throughs, less deductions). */
  workerPay: number;
  /** Employer on-cost. */
  employerCost: number;
  /** Total charged to the client. */
  clientCharge: number;
  /** CCG margin = clientCharge − workerPay − employerCost. */
  margin: number;
}

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const n0 = (v: number | undefined) => (Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0);

export function computeTimesheetPay(input: PayInput): PayResult {
  const basic = n0(input.basicHours);
  const ot = n0(input.overtimeHours);
  const payRate = n0(input.payRate);
  const chargeRate = n0(input.chargeRate);
  const oncost = n0(input.oncostRate);
  const otMult = input.overtimeMultiplier && input.overtimeMultiplier > 0 ? input.overtimeMultiplier : 1.5;
  const extras = n0(input.travel) + n0(input.lodge) + n0(input.expenses);
  const deductions = n0(input.deductions);

  const payBasic = basic * payRate;
  const payOvertime = ot * payRate * otMult;
  const chargeBasic = basic * chargeRate;
  const chargeOvertime = ot * chargeRate * otMult;

  const workerPay = r2(payBasic + payOvertime + extras - deductions);
  const employerCost = r2((basic + ot) * oncost);
  const clientCharge = r2(chargeBasic + chargeOvertime + extras);
  const margin = r2(clientCharge - workerPay - employerCost);

  return {
    totalHours: r2(basic + ot),
    payBasic: r2(payBasic),
    payOvertime: r2(payOvertime),
    workerPay,
    employerCost,
    clientCharge,
    margin,
  };
}
