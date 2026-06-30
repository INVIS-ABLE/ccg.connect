import { describe, it, expect } from 'vitest';
import { rankReplacementCandidates } from './replacement';
import { RTW_REQUIREMENT, type WorkerComplianceInput } from '../workforce/compliance';

const NOW = new Date('2026-06-15T00:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const w = (id: string, over: Partial<WorkerComplianceInput> = {}): WorkerComplianceInput => ({
  id,
  full_name: `Worker ${id}`,
  right_to_work_status: 'checked',
  rtw_expiry: null,
  cards: [],
  ...over,
});

describe('rankReplacementCandidates', () => {
  const requirements = [RTW_REQUIREMENT, 'CSCS'];

  it('ranks fully-compliant candidates above warnings above missing', () => {
    const candidates = [
      w('missing', { cards: [] }), // no CSCS → missing
      w('valid', { cards: [{ card_type: 'CSCS', expiry_date: inDays(200) }] }),
      w('warn', { cards: [{ card_type: 'CSCS', expiry_date: inDays(10) }] }),
    ];
    const ranked = rankReplacementCandidates(candidates, requirements, NOW);
    expect(ranked.map((r) => r.workerId)).toEqual(['valid', 'warn', 'missing']);
    expect(ranked[0]?.compliance.deployable).toBe(true);
    expect(ranked[2]?.compliance.deployable).toBe(false);
  });

  it('breaks ties by name', () => {
    const ranked = rankReplacementCandidates(
      [w('b', { full_name: 'Bravo', cards: [{ card_type: 'CSCS', expiry_date: inDays(200) }] }),
       w('a', { full_name: 'Alpha', cards: [{ card_type: 'CSCS', expiry_date: inDays(200) }] })],
      requirements,
      NOW,
    );
    expect(ranked.map((r) => r.name)).toEqual(['Alpha', 'Bravo']);
  });
});
