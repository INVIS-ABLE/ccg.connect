import { describe, it, expect } from 'vitest';
import { scoreMatch, haversineMiles, type JobRequirement, type ContractorForMatch } from './score';

const LONDON = { lat: 51.5074, lng: -0.1278 };
const CANTERBURY = { lat: 51.28, lng: 1.08 }; // ~55 mi from London

const baseJob: JobRequirement = {
  location: LONDON,
  startDate: '2026-07-01',
  requiredSkillIds: ['bricklaying'],
  requiredCredentialTypeIds: ['cscs'],
};

const eligibleContractor: ContractorForMatch = {
  base: LONDON,
  maxTravelMiles: 30,
  skillIds: ['bricklaying', 'groundwork'],
  credentials: [{ credential_type_id: 'cscs', verification_status: 'verified', expiry_date: '2027-01-01' }],
  preferred: false,
};

describe('haversineMiles', () => {
  it('is ~0 for the same point', () => {
    expect(haversineMiles(LONDON, LONDON)).toBeCloseTo(0, 5);
  });
  it('approximates London→Canterbury (~50–60 mi)', () => {
    const d = haversineMiles(LONDON, CANTERBURY);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(65);
  });
});

describe('scoreMatch eligibility gates', () => {
  it('eligible when skills + credentials + range are satisfied', () => {
    const r = scoreMatch(baseJob, eligibleContractor);
    expect(r.eligible).toBe(true);
    expect(r.totalScore).toBeGreaterThan(0);
  });

  it('ineligible when a required skill is missing', () => {
    const r = scoreMatch(baseJob, { ...eligibleContractor, skillIds: ['groundwork'] });
    expect(r.eligible).toBe(false);
    expect(r.breakdown.skill).toBe(0);
    expect(r.reasons.join(' ')).toMatch(/required skill/i);
  });

  it('ineligible when a required credential is expired before job start', () => {
    const r = scoreMatch(baseJob, {
      ...eligibleContractor,
      credentials: [{ credential_type_id: 'cscs', verification_status: 'verified', expiry_date: '2026-06-01' }],
    });
    expect(r.eligible).toBe(false);
    expect(r.breakdown.credential).toBe(0);
  });

  it('ineligible when a required credential is not verified', () => {
    const r = scoreMatch(baseJob, {
      ...eligibleContractor,
      credentials: [{ credential_type_id: 'cscs', verification_status: 'awaiting_review', expiry_date: '2027-01-01' }],
    });
    expect(r.eligible).toBe(false);
  });

  it('treats a credential with no expiry as valid', () => {
    const r = scoreMatch(baseJob, {
      ...eligibleContractor,
      credentials: [{ credential_type_id: 'cscs', verification_status: 'verified', expiry_date: null }],
    });
    expect(r.eligible).toBe(true);
  });

  it('ineligible when the site is outside the travel radius', () => {
    const r = scoreMatch(baseJob, { ...eligibleContractor, base: CANTERBURY, maxTravelMiles: 30 });
    expect(r.eligible).toBe(false);
    expect(r.breakdown.distance).toBe(0);
    expect(r.distanceMiles).toBeGreaterThan(30);
  });
});

describe('scoreMatch scoring', () => {
  it('scores nearer contractors higher on distance', () => {
    const near = scoreMatch(baseJob, eligibleContractor); // base at site
    const far = scoreMatch(baseJob, { ...eligibleContractor, base: { lat: 51.6, lng: -0.5 }, maxTravelMiles: 60 });
    expect(near.breakdown.distance).toBeGreaterThan(far.breakdown.distance);
  });

  it('drops availability to 0 on a start-date conflict but stays eligible', () => {
    const r = scoreMatch(baseJob, {
      ...eligibleContractor,
      unavailable: [{ start: '2026-06-28', end: '2026-07-05' }],
    });
    expect(r.breakdown.availability).toBe(0);
    expect(r.eligible).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/unavailable/i);
  });

  it('rewards preferred contractors', () => {
    const normal = scoreMatch(baseJob, eligibleContractor);
    const preferred = scoreMatch(baseJob, { ...eligibleContractor, preferred: true });
    expect(preferred.totalScore).toBeGreaterThan(normal.totalScore);
  });

  it('uses a neutral distance score when locations are unknown', () => {
    const r = scoreMatch(
      { ...baseJob, location: null },
      { ...eligibleContractor, base: null },
    );
    expect(r.breakdown.distance).toBe(50);
    expect(r.distanceMiles).toBeNull();
    expect(r.eligible).toBe(true);
  });
});
