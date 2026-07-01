import { describe, it, expect } from 'vitest';
import { billableQty, materialTotals, rollupMaterials, isMaterialCategory } from './materials';

describe('billableQty', () => {
  it('uses used_qty when recorded', () => {
    expect(billableQty({ used_qty: 7, issued_qty: 10 })).toBe(7);
  });
  it('falls back to issued minus returned, floored at 0', () => {
    expect(billableQty({ issued_qty: 10, returned_qty: 3 })).toBe(7);
    expect(billableQty({ issued_qty: 2, returned_qty: 5 })).toBe(0);
  });
});

describe('materialTotals', () => {
  it('costs on issued, charges on billable, computes margin', () => {
    const t = materialTotals({ issued_qty: 10, used_qty: 8, supplier_cost: 2, client_charge: 3.5, chargeable: true });
    expect(t.cost).toBe(20); // 2 × 10 issued
    expect(t.charge).toBe(28); // 3.5 × 8 used
    expect(t.margin).toBe(8);
  });
  it('never charges a non-chargeable line', () => {
    const t = materialTotals({ issued_qty: 5, used_qty: 5, supplier_cost: 4, client_charge: 9, chargeable: false });
    expect(t.charge).toBe(0);
    expect(t.margin).toBe(-20); // cost only
  });
});

describe('rollupMaterials', () => {
  it('sums cost, charge and margin across lines', () => {
    const r = rollupMaterials([
      { issued_qty: 10, used_qty: 8, supplier_cost: 2, client_charge: 3.5, chargeable: true },
      { issued_qty: 1, used_qty: 1, supplier_cost: 100, client_charge: 0, chargeable: false },
    ]);
    expect(r.count).toBe(2);
    expect(r.cost).toBe(120);
    expect(r.charge).toBe(28);
    expect(r.margin).toBe(-92);
  });
});

describe('isMaterialCategory', () => {
  it('validates the category enum', () => {
    expect(isMaterialCategory('plant')).toBe(true);
    expect(isMaterialCategory('spaceship')).toBe(false);
  });
});
