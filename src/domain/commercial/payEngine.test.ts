import { describe, it, expect } from 'vitest';
import { computeTimesheetPay } from './payEngine';

describe('computeTimesheetPay', () => {
  it('matches the worked example (£18 pay, £3.20 on-cost, £4.80 margin, £26 charge per hour)', () => {
    const r = computeTimesheetPay({ basicHours: 1, payRate: 18, chargeRate: 26, oncostRate: 3.2 });
    expect(r.workerPay).toBe(18);
    expect(r.employerCost).toBe(3.2);
    expect(r.clientCharge).toBe(26);
    expect(r.margin).toBe(4.8);
  });

  it('scales over a full week', () => {
    const r = computeTimesheetPay({ basicHours: 47, payRate: 18, chargeRate: 26, oncostRate: 3.2 });
    expect(r.totalHours).toBe(47);
    expect(r.workerPay).toBe(846); // 47 × 18
    expect(r.clientCharge).toBe(1222); // 47 × 26
    expect(r.margin).toBe(1222 - 846 - 150.4);
  });

  it('applies the overtime multiplier (default 1.5) to pay and charge', () => {
    const r = computeTimesheetPay({ basicHours: 40, overtimeHours: 5, payRate: 20, chargeRate: 30 });
    expect(r.payBasic).toBe(800);
    expect(r.payOvertime).toBe(150); // 5 × 20 × 1.5
    expect(r.workerPay).toBe(950);
    expect(r.clientCharge).toBe(40 * 30 + 5 * 30 * 1.5); // 1200 + 225
  });

  it('passes travel/lodge/expenses through to both pay and charge (margin-neutral) and deducts from pay only', () => {
    const base = computeTimesheetPay({ basicHours: 10, payRate: 15, chargeRate: 22, oncostRate: 2 });
    const withExtras = computeTimesheetPay({ basicHours: 10, payRate: 15, chargeRate: 22, oncostRate: 2, travel: 30, lodge: 40, deductions: 5 });
    expect(withExtras.workerPay).toBe(base.workerPay + 70 - 5);
    expect(withExtras.clientCharge).toBe(base.clientCharge + 70);
    // Pass-throughs cancel in the margin; only the deduction shifts it.
    expect(withExtras.margin).toBe(base.margin + 5);
  });

  it('rounds to pennies and treats blanks/negatives as zero', () => {
    const r = computeTimesheetPay({ basicHours: 3, payRate: 12.333, chargeRate: 0, oncostRate: 0 });
    expect(r.workerPay).toBe(37); // 3 × 12.333 = 36.999 → 37.00
    const z = computeTimesheetPay({ basicHours: -5, payRate: 18, chargeRate: 26, oncostRate: 3.2 });
    expect(z.workerPay).toBe(0);
  });
});
