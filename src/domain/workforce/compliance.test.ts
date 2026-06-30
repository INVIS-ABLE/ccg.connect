import { describe, it, expect } from 'vitest';
import {
  requirementStatus,
  complianceRow,
  complianceMatrix,
  mergeRequirements,
  RTW_REQUIREMENT,
  type WorkerComplianceInput,
} from './compliance';

const NOW = new Date('2026-06-15T00:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const worker = (over: Partial<WorkerComplianceInput> = {}): WorkerComplianceInput => ({
  id: 'w1',
  full_name: 'John Smith',
  right_to_work_status: 'checked',
  rtw_expiry: null,
  cards: [],
  ...over,
});

describe('requirementStatus', () => {
  it('ok when a valid card is held', () => {
    const w = worker({ cards: [{ card_type: 'CSCS', expiry_date: inDays(200) }] });
    expect(requirementStatus(w, 'CSCS', NOW)).toBe('ok');
  });
  it('case-insensitive card matching', () => {
    const w = worker({ cards: [{ card_type: 'cscs', expiry_date: inDays(200) }] });
    expect(requirementStatus(w, 'CSCS', NOW)).toBe('ok');
  });
  it('warning when the matching card is expiring soon', () => {
    const w = worker({ cards: [{ card_type: 'Medical', expiry_date: inDays(10) }] });
    expect(requirementStatus(w, 'Medical', NOW)).toBe('warning');
  });
  it('missing when no card or the card is expired', () => {
    expect(requirementStatus(worker(), 'CPCS', NOW)).toBe('missing');
    const w = worker({ cards: [{ card_type: 'CPCS', expiry_date: inDays(-1) }] });
    expect(requirementStatus(w, 'CPCS', NOW)).toBe('missing');
  });
  it('RTW requirement uses the right-to-work state', () => {
    expect(requirementStatus(worker({ right_to_work_status: 'checked' }), RTW_REQUIREMENT, NOW)).toBe('ok');
    expect(requirementStatus(worker({ right_to_work_status: 'unchecked' }), RTW_REQUIREMENT, NOW)).toBe('missing');
  });
});

describe('complianceRow', () => {
  it('is deployable only when nothing is missing (warnings allowed)', () => {
    const w = worker({
      cards: [{ card_type: 'CSCS', expiry_date: inDays(200) }, { card_type: 'Medical', expiry_date: inDays(10) }],
    });
    const row = complianceRow(w, [RTW_REQUIREMENT, 'CSCS', 'Medical'], NOW);
    expect(row.cells).toEqual({ RTW: 'ok', CSCS: 'ok', Medical: 'warning' });
    expect(row.deployable).toBe(true);
  });
  it('not deployable when a mandatory requirement is missing', () => {
    const row = complianceRow(worker(), [RTW_REQUIREMENT, 'CPCS'], NOW);
    expect(row.deployable).toBe(false);
  });
});

describe('complianceMatrix + mergeRequirements', () => {
  it('evaluates every worker', () => {
    const rows = complianceMatrix([worker({ id: 'a' }), worker({ id: 'b', right_to_work_status: 'restricted' })], [RTW_REQUIREMENT], NOW);
    expect(rows.map((r) => r.deployable)).toEqual([true, false]);
  });
  it('merges requirement sources without duplicates (case-insensitive)', () => {
    expect(mergeRequirements(['CSCS', 'RTW'], ['cscs', 'Medical'], ['', '  '])).toEqual(['CSCS', 'RTW', 'Medical']);
  });
});
