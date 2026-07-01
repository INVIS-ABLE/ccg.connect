import { describe, it, expect } from 'vitest';
import { applySurcharges, isSurchargeKind } from './pricing';

describe('applySurcharges', () => {
  it('applies percentages to the base (not compounded) plus fixed additions', () => {
    const r = applySurcharges(20, [
      { label: 'Night shift', kind: 'percent', value: 15 },
      { label: 'Weekend', kind: 'percent', value: 25 },
      { label: 'Lodge', kind: 'fixed', value: 2 },
    ]);
    expect(r.base).toBe(20);
    // 20 + (3 + 5) + 2 = 30
    expect(r.effective).toBe(30);
    expect(r.breakdown.map((b) => b.amount)).toEqual([3, 5, 2]);
  });

  it('returns the base when there are no surcharges', () => {
    const r = applySurcharges(18.5, []);
    expect(r.effective).toBe(18.5);
    expect(r.breakdown).toEqual([]);
  });

  it('penny-rounds', () => {
    const r = applySurcharges(17.99, [{ label: 'Urgency', kind: 'percent', value: 12.5 }]);
    expect(r.breakdown[0]!.amount).toBe(2.25); // 17.99 * 0.125 = 2.24875 → 2.25
    expect(r.effective).toBe(20.24);
  });
});

describe('isSurchargeKind', () => {
  it('validates the kind', () => {
    expect(isSurchargeKind('percent')).toBe(true);
    expect(isSurchargeKind('fixed')).toBe(true);
    expect(isSurchargeKind('multiply')).toBe(false);
  });
});
