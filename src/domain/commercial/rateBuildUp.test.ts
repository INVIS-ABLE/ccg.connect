import { describe, it, expect } from 'vitest';
import { buildUpRate } from './rateBuildUp';

describe('buildUpRate', () => {
  it('builds up pay → on-costs → margin → charge with VAT', () => {
    const r = buildUpRate({
      payRate: 20,
      holidayPct: 12.07,
      pensionPct: 3,
      employerNiPct: 0,
      marginKind: 'percent',
      marginValue: 15,
      vatRatePct: 20,
    });
    expect(r.holidayCost).toBe(2.41); // 20 * 0.1207 = 2.414 → 2.41
    expect(r.pensionCost).toBe(0.6); // 20 * 0.03
    expect(r.oncostTotal).toBe(3.01);
    expect(r.labourCost).toBe(23.01);
    expect(r.margin).toBe(3.45); // 15% of 23.01 = 3.4515 → 3.45
    expect(r.chargeExVat).toBe(26.46); // 23.01 + 3.45 (no pass-through)
    expect(r.vatAmount).toBe(5.29); // 26.46 * 0.2 = 5.292 → 5.29
    expect(r.chargeIncVat).toBe(31.75);
  });

  it('recovers pass-throughs at cost — no margin taken on travel/lodge', () => {
    const withPass = buildUpRate({ payRate: 20, marginKind: 'percent', marginValue: 10, travelPerHour: 2, lodgePerHour: 3 });
    const without = buildUpRate({ payRate: 20, marginKind: 'percent', marginValue: 10 });
    // Margin is 10% of labour cost (20) in both cases — pass-throughs don't inflate it.
    expect(withPass.margin).toBe(2);
    expect(without.margin).toBe(2);
    expect(withPass.passThrough).toBe(5);
    expect(withPass.chargeExVat).toBe(27); // 20 + 2 margin + 5 pass-through
    expect(without.chargeExVat).toBe(22);
  });

  it('supports a fixed £/hr margin', () => {
    const r = buildUpRate({ payRate: 18, holidayPct: 12.07, marginKind: 'fixed', marginValue: 5 });
    expect(r.margin).toBe(5);
    expect(r.labourCost).toBe(r2(18 + r2(18 * 0.1207)));
    expect(r.chargeExVat).toBe(r2(r.labourCost + 5));
  });

  it('returns zeros for a zero pay rate and null margin percentage', () => {
    const r = buildUpRate({ payRate: 0, marginKind: 'percent', marginValue: 20 });
    expect(r.labourCost).toBe(0);
    expect(r.chargeExVat).toBe(0);
    expect(r.marginPctOfCharge).toBeNull();
    expect(r.breakdown).toEqual([]);
  });

  it('reports margin as a percentage of the ex-VAT charge', () => {
    const r = buildUpRate({ payRate: 100, marginKind: 'fixed', marginValue: 25, vatRatePct: 20 });
    expect(r.chargeExVat).toBe(125);
    expect(r.marginPctOfCharge).toBe(20); // 25 / 125 * 100
  });

  it('treats negatives and non-finite inputs as zero', () => {
    const r = buildUpRate({ payRate: -5, holidayPct: -10, marginKind: 'percent', marginValue: Number.NaN });
    expect(r.payRate).toBe(0);
    expect(r.holidayCost).toBe(0);
    expect(r.margin).toBe(0);
    expect(r.chargeExVat).toBe(0);
  });

  it('omits zero lines from the breakdown but keeps non-zero ones', () => {
    const r = buildUpRate({ payRate: 20, holidayPct: 12.07, marginKind: 'percent', marginValue: 10 });
    const labels = r.breakdown.map((l) => l.label);
    expect(labels).toContain('Worker pay');
    expect(labels).toContain('Holiday');
    expect(labels).toContain('CCG margin');
    expect(labels).not.toContain('Pension'); // not supplied → 0 → omitted
    expect(labels).not.toContain('Travel & lodge');
  });
});

const r2 = (n: number) => Math.round(n * 100) / 100;
