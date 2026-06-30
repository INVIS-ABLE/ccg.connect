import { describe, it, expect } from 'vitest';
import {
  LABOUR_REQUEST_STATUSES,
  isLabourRequestStatus,
  nextStatuses,
  canTransition,
  isTerminal,
  labourRequestStatusLabel,
} from './labourRequestStatus';

describe('labour request status pipeline', () => {
  it('validates membership', () => {
    expect(isLabourRequestStatus('open')).toBe(true);
    expect(isLabourRequestStatus('nope')).toBe(false);
  });

  it('follows the forward pipeline', () => {
    expect(nextStatuses('draft')).toContain('awaiting_approval');
    expect(canTransition('open', 'sourcing')).toBe(true);
    expect(canTransition('confirmed', 'active')).toBe(true);
  });

  it('cancel is reachable from every live state but not terminals', () => {
    for (const s of LABOUR_REQUEST_STATUSES) {
      if (s === 'completed' || s === 'cancelled') {
        expect(canTransition(s, 'cancelled')).toBe(false);
      } else {
        expect(canTransition(s, 'cancelled')).toBe(true);
      }
    }
  });

  it('rejects illegal jumps', () => {
    expect(canTransition('draft', 'active')).toBe(false);
    expect(canTransition('completed', 'active')).toBe(false);
  });

  it('marks terminal states', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('open')).toBe(false);
  });

  it('humanises labels', () => {
    expect(labourRequestStatusLabel('partially_filled')).toBe('Partially filled');
  });
});
