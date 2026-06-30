import { describe, it, expect } from 'vitest';
import {
  EMPLOYMENT_MODELS,
  isEmploymentModel,
  employmentModelInfo,
  listEmploymentModels,
  requiresTaxReview,
} from './employmentModels';

describe('employment models', () => {
  it('exposes exactly the three supply models', () => {
    expect([...EMPLOYMENT_MODELS]).toEqual([
      'labour_supply',
      'managed_workforce',
      'subcontract_work_package',
    ]);
  });

  it('validates membership', () => {
    expect(isEmploymentModel('labour_supply')).toBe(true);
    expect(isEmploymentModel('permanent')).toBe(false);
    expect(isEmploymentModel(null)).toBe(false);
  });

  it('returns label + summary for each model', () => {
    const info = employmentModelInfo('subcontract_work_package');
    expect(info.label).toMatch(/subcontract/i);
    expect(info.summary.length).toBeGreaterThan(10);
  });

  it('flags EVERY model for professional tax review (never auto-decides status)', () => {
    expect(listEmploymentModels().every((m) => m.taxReviewRequired)).toBe(true);
    for (const m of EMPLOYMENT_MODELS) expect(requiresTaxReview(m)).toBe(true);
  });
});
