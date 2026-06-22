import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray } from 'drizzle-orm';
import {
  jobs,
  jobRequiredSkills,
  jobRequiredCredentials,
  contractorProfiles,
  contractorSkills,
  contractorCredentials,
  contractorAvailability,
} from '../db/schema';
import { requireAuth } from '../lib/session';
import { canManageJobs } from '../../src/domain/permissions/permissions';
import {
  scoreMatch,
  type JobRequirement,
  type ContractorForMatch,
} from '../../src/domain/matching/score';
import type { AppEnv } from '../env';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);

const UNAVAILABLE_TYPES = new Set(['unavailable', 'holiday', 'on_assignment']);

function groupByContractor<T extends { contractor_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.contractor_id);
    if (list) list.push(r);
    else map.set(r.contractor_id, [r]);
  }
  return map;
}

// GET /api/match/:jobId — ranked, explainable candidate contractors for a job.
// Admin only (invariant 12/13: computes a ranking, never assigns).
route.get('/:jobId', async (c) => {
  const p = c.get('principal');
  if (!canManageJobs(p)) return c.json({ error: 'forbidden' }, 403);

  const db = drizzle(c.env.DB);
  const jobId = c.req.param('jobId');

  const jobRows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = jobRows[0];
  if (!job) return c.json({ error: 'not_found' }, 404);

  const reqSkills = await db
    .select({ skill_id: jobRequiredSkills.skill_id, mandatory: jobRequiredSkills.mandatory })
    .from(jobRequiredSkills)
    .where(eq(jobRequiredSkills.job_id, jobId));
  const reqCreds = await db
    .select({
      credential_type_id: jobRequiredCredentials.credential_type_id,
      mandatory: jobRequiredCredentials.mandatory,
    })
    .from(jobRequiredCredentials)
    .where(eq(jobRequiredCredentials.job_id, jobId));

  const requirement: JobRequirement = {
    location:
      job.latitude != null && job.longitude != null
        ? { lat: job.latitude, lng: job.longitude }
        : null,
    startDate: job.start_date,
    requiredSkillIds: reqSkills.filter((s) => s.mandatory).map((s) => s.skill_id),
    optionalSkillIds: reqSkills.filter((s) => !s.mandatory).map((s) => s.skill_id),
    requiredCredentialTypeIds: reqCreds.filter((cr) => cr.mandatory).map((cr) => cr.credential_type_id),
  };

  const contractors = await db
    .select()
    .from(contractorProfiles)
    .where(eq(contractorProfiles.approval_status, 'approved'))
    .limit(500);
  const ids = contractors.map((ct) => ct.id);
  if (ids.length === 0) return c.json({ job_id: jobId, matches: [] });

  const [skills, creds, avail] = await Promise.all([
    db.select().from(contractorSkills).where(inArray(contractorSkills.contractor_id, ids)),
    db.select().from(contractorCredentials).where(inArray(contractorCredentials.contractor_id, ids)),
    db.select().from(contractorAvailability).where(inArray(contractorAvailability.contractor_id, ids)),
  ]);
  const skillsByC = groupByContractor(skills);
  const credsByC = groupByContractor(creds);
  const availByC = groupByContractor(avail);

  const matches = contractors.map((ct) => {
    const candidate: ContractorForMatch = {
      // Contractor coordinates are not stored yet → distance is neutral until a
      // geocoding adapter lands; the travel-radius gate still applies when coords exist.
      base: null,
      maxTravelMiles: ct.maximum_travel_miles ?? null,
      skillIds: (skillsByC.get(ct.id) ?? []).map((s) => s.skill_id),
      credentials: (credsByC.get(ct.id) ?? []).map((cr) => ({
        credential_type_id: cr.credential_type_id,
        verification_status: cr.verification_status,
        expiry_date: cr.expiry_date,
      })),
      unavailable: (availByC.get(ct.id) ?? [])
        .filter((a) => UNAVAILABLE_TYPES.has(a.availability_type))
        .map((a) => ({ start: a.start_date, end: a.end_date })),
      preferred: ct.preferred_contractor,
    };
    return { contractor_id: ct.id, trading_name: ct.trading_name, ...scoreMatch(requirement, candidate) };
  });

  matches.sort(
    (a, b) => Number(b.eligible) - Number(a.eligible) || b.totalScore - a.totalScore,
  );
  return c.json({ job_id: jobId, matches });
});

export default route;
