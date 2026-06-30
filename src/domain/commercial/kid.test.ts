import { describe, it, expect } from 'vitest';
import { defaultKid, missingKidFields, isKidComplete, isKidStatus } from './kid';

describe('defaultKid', () => {
  it('prefills paid-by and contract type from the payment model', () => {
    const k = defaultKid({ paymentModel: 'paye', payRate: 18 });
    expect(k.paid_by).toMatch(/PAYE/);
    expect(k.contract_type).toMatch(/employment/i);
    expect(k.pay_rate).toBe(18);
  });

  it('leaves contract type blank for an unknown model', () => {
    const k = defaultKid({ paymentModel: null });
    expect(k.contract_type).toBe('');
  });
});

describe('missingKidFields / isKidComplete', () => {
  it('flags blank required fields including a zero/absent pay rate', () => {
    const partial = defaultKid({ paymentModel: 'paye' }); // no payRate
    expect(missingKidFields(partial)).toContain('pay_rate');
    expect(isKidComplete(partial)).toBe(false);
  });

  it('is complete once the required facts are present', () => {
    const full = { ...defaultKid({ paymentModel: 'paye', payRate: 18 }) };
    expect(missingKidFields(full)).toEqual([]);
    expect(isKidComplete(full)).toBe(true);
  });
});

describe('isKidStatus', () => {
  it('accepts the four lifecycle states only', () => {
    expect(isKidStatus('issued')).toBe(true);
    expect(isKidStatus('signed')).toBe(false);
  });
});
