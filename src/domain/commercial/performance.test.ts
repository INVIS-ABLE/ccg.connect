import { describe, it, expect } from 'vitest';
import { averageScore, isValidScores, requiresEvidence, isReviewDirection, PERFORMANCE_DIMENSIONS } from './performance';

describe('averageScore', () => {
  it('averages present 1..5 scores to 0.1', () => {
    expect(averageScore({ a: 5, b: 4, c: 3 })).toBe(4);
    expect(averageScore({ a: 5, b: 4 })).toBe(4.5);
  });
  it('ignores out-of-range values and returns null when empty', () => {
    expect(averageScore({ a: 0, b: 9 })).toBe(null);
    expect(averageScore({})).toBe(null);
  });
});

describe('isValidScores', () => {
  it('requires every value to be an integer 1..5', () => {
    expect(isValidScores({ a: 1, b: 5 })).toBe(true);
    expect(isValidScores({ a: 3.5 })).toBe(false);
    expect(isValidScores({ a: 6 })).toBe(false);
    expect(isValidScores('nope')).toBe(false);
  });
});

describe('requiresEvidence', () => {
  it('flags any poor score (<=2) as needing evidence', () => {
    expect(requiresEvidence({ a: 4, b: 5 })).toBe(false);
    expect(requiresEvidence({ a: 4, b: 2 })).toBe(true);
    expect(requiresEvidence({ a: 1 })).toBe(true);
  });
});

describe('dimensions & direction', () => {
  it('has distinct dimensions per direction', () => {
    expect(PERFORMANCE_DIMENSIONS.client_on_worker.length).toBeGreaterThan(0);
    expect(PERFORMANCE_DIMENSIONS.worker_on_site.length).toBeGreaterThan(0);
    expect(isReviewDirection('client_on_worker')).toBe(true);
    expect(isReviewDirection('peer')).toBe(false);
  });
});
