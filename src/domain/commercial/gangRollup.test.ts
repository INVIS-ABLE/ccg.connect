import { describe, it, expect } from 'vitest';
import { computeGangRollup, type RollupMember } from './gangRollup';

const member = (over: Partial<RollupMember> = {}): RollupMember => ({
  role: 'permanent',
  right_to_work_status: 'checked',
  available_from: null,
  day_rate: 200,
  cards: [],
  ...over,
});

const TODAY = new Date('2026-07-01T09:00:00Z');

describe('computeGangRollup', () => {
  it('returns zeroed figures for an empty gang', () => {
    const r = computeGangRollup([], null, TODAY);
    expect(r.totalMembers).toBe(0);
    expect(r.coreMembers).toBe(0);
    expect(r.qualifications).toEqual([]);
    expect(r.payCostPerDay).toBe(0);
    expect(r.chargePerDay).toBeNull();
    expect(r.marginPerDay).toBeNull();
    expect(r.marginPct).toBeNull();
    expect(r.earliestAvailable).toBeNull();
  });

  it('sums pay cost over core members only (reserves excluded)', () => {
    const r = computeGangRollup(
      [
        member({ role: 'leader', day_rate: 260 }),
        member({ role: 'permanent', day_rate: 200 }),
        member({ role: 'reserve', day_rate: 180 }),
      ],
      null,
      TODAY,
    );
    expect(r.totalMembers).toBe(3);
    expect(r.coreMembers).toBe(2);
    expect(r.reserveMembers).toBe(1);
    expect(r.payCostPerDay).toBe(460); // 260 + 200, reserve's 180 excluded
  });

  it('treats missing day rates as zero without breaking the sum', () => {
    const r = computeGangRollup(
      [member({ day_rate: 200 }), member({ day_rate: null }), member({ day_rate: 150 })],
      null,
      TODAY,
    );
    expect(r.payCostPerDay).toBe(350);
  });

  it('computes charge, margin and margin percentage with rounding', () => {
    const r = computeGangRollup([member({ role: 'leader', day_rate: 200 })], 300, TODAY);
    expect(r.chargePerDay).toBe(300);
    expect(r.marginPerDay).toBe(100);
    expect(r.marginPct).toBe(33.33); // 100/300*100 = 33.333… → 33.33
  });

  it('reports a negative margin when the gang costs more than it charges', () => {
    const r = computeGangRollup([member({ role: 'permanent', day_rate: 350 })], 300, TODAY);
    expect(r.marginPerDay).toBe(-50);
    expect(r.marginPct).toBe(-16.67);
  });

  it('leaves margin null when no charge rate is set, and pct null when charge is 0', () => {
    expect(computeGangRollup([member({ day_rate: 200 })], null, TODAY).marginPerDay).toBeNull();
    const zero = computeGangRollup([member({ day_rate: 200 })], 0, TODAY);
    expect(zero.marginPerDay).toBe(-200);
    expect(zero.marginPct).toBeNull(); // avoid divide-by-zero
  });

  it('de-duplicates and sorts only verified qualifications', () => {
    const r = computeGangRollup(
      [
        member({ cards: [{ card_type: 'CSCS', verification_status: 'verified' }, { card_type: 'CPCS', verification_status: 'verified' }] }),
        member({ cards: [{ card_type: 'CSCS', verification_status: 'verified' }, { card_type: 'SSSTS', verification_status: 'unverified' }] }),
      ],
      null,
      TODAY,
    );
    expect(r.qualifications).toEqual(['CPCS', 'CSCS']); // SSSTS unverified → excluded, CSCS de-duped
  });

  it('counts availability today and picks the earliest future date', () => {
    const r = computeGangRollup(
      [
        member({ available_from: null }), // now
        member({ available_from: '2026-06-01' }), // past → now
        member({ available_from: '2026-08-15' }), // future
        member({ available_from: '2026-07-20' }), // future, earlier
      ],
      null,
      TODAY,
    );
    expect(r.availableNow).toBe(2);
    expect(r.earliestAvailable).toBe('2026-07-20');
  });

  it('counts right-to-work as valid only when checked', () => {
    const r = computeGangRollup(
      [
        member({ right_to_work_status: 'checked' }),
        member({ right_to_work_status: 'expired' }),
        member({ right_to_work_status: 'unchecked' }),
      ],
      null,
      TODAY,
    );
    expect(r.rtwValid).toBe(1);
  });
});
