import { describe, it, expect } from 'vitest';
import { lineTotal, jobCostBreakdown, parseMaterials, applyVat } from './costing';

describe('lineTotal', () => {
  it('multiplies qty by unit cost', () => {
    expect(lineTotal({ qty: 3, unit_cost: 12.5 })).toBe(37.5);
  });
  it('coerces numeric strings from form inputs', () => {
    expect(lineTotal({ qty: '2', unit_cost: '10' })).toBe(20);
  });
  it('treats blanks/negatives as zero', () => {
    expect(lineTotal({ qty: '', unit_cost: 10 })).toBe(0);
    expect(lineTotal({ qty: -3, unit_cost: 10 })).toBe(0);
    expect(lineTotal({})).toBe(0);
  });
});

describe('jobCostBreakdown', () => {
  it('sums materials and adds labour', () => {
    const out = jobCostBreakdown(
      [
        { description: 'Paint', qty: 4, unit_cost: 15 },
        { description: 'Brushes', qty: 2, unit_cost: 5 },
      ],
      200,
    );
    expect(out).toEqual({ materialsCost: 70, labourCost: 200, total: 270 });
  });
  it('handles no materials and string labour', () => {
    expect(jobCostBreakdown([], '150')).toEqual({ materialsCost: 0, labourCost: 150, total: 150 });
  });
  it('ignores invalid labour', () => {
    expect(jobCostBreakdown([{ qty: 1, unit_cost: 10 }], 'abc').total).toBe(10);
  });
});

describe('applyVat', () => {
  it('adds 20% VAT by default', () => {
    expect(applyVat(100)).toEqual({ vat: 20, totalIncVat: 120 });
  });
  it('honours a custom rate', () => {
    expect(applyVat(200, 0.05)).toEqual({ vat: 10, totalIncVat: 210 });
  });
  it('treats a zero/invalid rate or net as no VAT', () => {
    expect(applyVat(100, 0)).toEqual({ vat: 0, totalIncVat: 100 });
    expect(applyVat(NaN)).toEqual({ vat: 0, totalIncVat: 0 });
  });
});

describe('parseMaterials', () => {
  it('parses a valid JSON array', () => {
    expect(parseMaterials('[{"description":"Nails","qty":1,"unit_cost":2}]')).toEqual([
      { description: 'Nails', qty: 1, unit_cost: 2 },
    ]);
  });
  it('returns [] for null, empty, non-array or malformed input', () => {
    expect(parseMaterials(null)).toEqual([]);
    expect(parseMaterials('')).toEqual([]);
    expect(parseMaterials('{"not":"array"}')).toEqual([]);
    expect(parseMaterials('not json')).toEqual([]);
  });
});
