import { describe, it, expect } from 'vitest';
import { buildCommercialInvoice } from './invoice';

describe('buildCommercialInvoice', () => {
  it('sums lines and applies 20% VAT by default', () => {
    const r = buildCommercialInvoice([
      { description: 'Smith — wk 13 Jul (47h)', amount: 1222 },
      { description: 'Jones — wk 13 Jul (45h)', amount: 1170 },
    ]);
    expect(r.net).toBe(2392);
    expect(r.vat).toBe(478.4);
    expect(r.gross).toBe(2870.4);
    expect(r.lineItems).toHaveLength(2);
  });

  it('honours a custom VAT rate and rounds to pennies', () => {
    const r = buildCommercialInvoice([{ description: 'x', amount: 100.005 }], 0.05);
    expect(r.net).toBe(100.01); // rounded line
    expect(r.vat).toBe(5); // 100.01 × 0.05 = 5.0005 → 5.00
    expect(r.gross).toBe(105.01);
  });

  it('handles an empty invoice and a zero rate', () => {
    expect(buildCommercialInvoice([]).net).toBe(0);
    expect(buildCommercialInvoice([{ description: 'x', amount: 50 }], 0).gross).toBe(50);
  });
});
