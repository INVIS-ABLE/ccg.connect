import { describe, it, expect } from 'vitest';
import { computeVat, invoiceTotals } from './vat';

describe('computeVat', () => {
  it('applies standard 20% VAT', () => {
    expect(computeVat(100, 20)).toEqual({ net: 100, vatRate: 20, vat: 20, gross: 120 });
  });

  it('defaults to 20%', () => {
    expect(computeVat(250)).toEqual({ net: 250, vatRate: 20, vat: 50, gross: 300 });
  });

  it('handles 0% VAT', () => {
    expect(computeVat(99.99, 0)).toEqual({ net: 99.99, vatRate: 0, vat: 0, gross: 99.99 });
  });

  it('rounds VAT to the penny', () => {
    // 33.33 * 20% = 6.666 → 6.67; gross 40.00
    expect(computeVat(33.33, 20)).toEqual({ net: 33.33, vatRate: 20, vat: 6.67, gross: 40 });
  });

  it('supports reduced 5% rate', () => {
    expect(computeVat(200, 5)).toEqual({ net: 200, vatRate: 5, vat: 10, gross: 210 });
  });

  it('rejects negative amounts/rates', () => {
    expect(() => computeVat(-1, 20)).toThrow();
    expect(() => computeVat(100, -5)).toThrow();
  });
});

describe('invoiceTotals', () => {
  it('sums line nets then applies VAT to the total', () => {
    expect(invoiceTotals([100, 50.5, 9.5], 20)).toEqual({
      net: 160,
      vatRate: 20,
      vat: 32,
      gross: 192,
    });
  });

  it('is empty-safe', () => {
    expect(invoiceTotals([], 20)).toEqual({ net: 0, vatRate: 20, vat: 0, gross: 0 });
  });
});
