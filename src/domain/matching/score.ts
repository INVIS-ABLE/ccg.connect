import { clamp } from '../shared/number';

/**
 * Explainable contractor↔job match scoring (CLAUDE.md invariant 13: matching must
 * be explainable and must NOT make the final assignment). Pure and unit-tested.
 *
 * It produces an eligibility verdict (hard gates: mandatory skills, valid
 * mandatory credentials, travel range) and a 0–100 score with a breakdown and
 * human-readable reasons. An admin still makes the assignment.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface JobRequirement {
  location?: GeoPoint | null;
  /** ISO date the job starts; used for credential validity + availability. */
  startDate?: string | null;
  requiredSkillIds: string[];
  optionalSkillIds?: string[];
  requiredCredentialTypeIds?: string[];
}

export interface CredentialInfo {
  credential_type_id: string;
  verification_status: string;
  /** ISO date; null/undefined means it does not expire. */
  expiry_date?: string | null;
}

export interface Unavailability {
  start: string; // ISO date
  end?: string | null; // ISO date; null = single day
}

export interface ContractorForMatch {
  base?: GeoPoint | null;
  maxTravelMiles?: number | null;
  skillIds: string[];
  credentials?: CredentialInfo[];
  unavailable?: Unavailability[];
  preferred?: boolean;
}

export interface MatchBreakdown {
  skill: number;
  distance: number;
  availability: number;
  credential: number;
  preference: number;
}

export interface MatchResult {
  eligible: boolean;
  totalScore: number; // 0..100
  breakdown: MatchBreakdown;
  distanceMiles: number | null;
  reasons: string[];
}

const WEIGHTS: MatchBreakdown = {
  skill: 0.35,
  distance: 0.25,
  availability: 0.15,
  credential: 0.15,
  preference: 0.1,
};

/** Great-circle distance in miles. */
export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.7613; // Earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function credentialValid(cred: CredentialInfo, asOf: Date): boolean {
  if (cred.verification_status !== 'verified') return false;
  if (!cred.expiry_date) return true; // does not expire
  const expiry = new Date(cred.expiry_date);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() >= asOf.getTime();
}

function dateInRange(day: Date, u: Unavailability): boolean {
  const start = new Date(u.start);
  const end = u.end ? new Date(u.end) : start;
  return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
}

export function scoreMatch(
  job: JobRequirement,
  contractor: ContractorForMatch,
  opts: { now?: Date } = {},
): MatchResult {
  const reasons: string[] = [];
  const asOf = job.startDate ? new Date(job.startDate) : (opts.now ?? new Date());
  const contractorSkills = new Set(contractor.skillIds);

  // ── Hard gate: mandatory skills ──
  const missingSkills = job.requiredSkillIds.filter((s) => !contractorSkills.has(s));
  const skillsOk = missingSkills.length === 0;
  if (skillsOk && job.requiredSkillIds.length > 0) {
    reasons.push(`All ${job.requiredSkillIds.length} required skill(s) matched`);
  } else if (!skillsOk) {
    reasons.push(`Missing ${missingSkills.length} required skill(s)`);
  }

  // ── Hard gate: mandatory credentials valid at job start ──
  const requiredCreds = job.requiredCredentialTypeIds ?? [];
  const creds = contractor.credentials ?? [];
  const missingCreds = requiredCreds.filter(
    (typeId) => !creds.some((c) => c.credential_type_id === typeId && credentialValid(c, asOf)),
  );
  const credsOk = missingCreds.length === 0;
  if (!credsOk) {
    reasons.push(`Missing/expired ${missingCreds.length} required credential(s)`);
  } else if (requiredCreds.length > 0) {
    reasons.push(`All ${requiredCreds.length} required credential(s) valid`);
  }

  // ── Distance ──
  let distanceMiles: number | null = null;
  let distanceScore = 50; // neutral when unknown
  let inRange = true;
  if (job.location && contractor.base) {
    distanceMiles = Math.round(haversineMiles(contractor.base, job.location) * 10) / 10;
    const max = contractor.maxTravelMiles ?? null;
    if (max != null) {
      inRange = distanceMiles <= max;
      distanceScore = inRange ? clamp(100 * (1 - distanceMiles / max), 0, 100) : 0;
      reasons.push(
        inRange
          ? `${distanceMiles} mi from site (within ${max} mi radius)`
          : `${distanceMiles} mi from site (outside ${max} mi radius)`,
      );
    } else {
      // No declared limit: gentle decay with distance.
      distanceScore = clamp(100 - distanceMiles * 1.5, 0, 100);
      reasons.push(`${distanceMiles} mi from site`);
    }
  }

  // ── Availability ──
  let availabilityScore = 100;
  if (job.startDate) {
    const conflict = (contractor.unavailable ?? []).some((u) => dateInRange(asOf, u));
    if (conflict) {
      availabilityScore = 0;
      reasons.push('Unavailable on the job start date');
    }
  }

  // ── Skill / credential component scores ──
  const optional = job.optionalSkillIds ?? [];
  const optionalMatched = optional.filter((s) => contractorSkills.has(s)).length;
  const optionalFraction = optional.length ? optionalMatched / optional.length : 1;
  const skillScore = skillsOk ? 70 + 30 * optionalFraction : 0;
  const credentialScore = credsOk ? 100 : 0;
  const preferenceScore = contractor.preferred ? 100 : 50;

  const breakdown: MatchBreakdown = {
    skill: Math.round(skillScore),
    distance: Math.round(distanceScore),
    availability: availabilityScore,
    credential: credentialScore,
    preference: preferenceScore,
  };

  const totalScore = Math.round(
    breakdown.skill * WEIGHTS.skill +
      breakdown.distance * WEIGHTS.distance +
      breakdown.availability * WEIGHTS.availability +
      breakdown.credential * WEIGHTS.credential +
      breakdown.preference * WEIGHTS.preference,
  );

  // Eligibility = mandatory skills + mandatory credentials + within travel range.
  const eligible = skillsOk && credsOk && inRange;

  return { eligible, totalScore, breakdown, distanceMiles, reasons };
}
