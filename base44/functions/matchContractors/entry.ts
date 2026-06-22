import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Haversine distance in miles between two lat/lng points
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PROFICIENCY_SCORES = { expert: 100, experienced: 75, intermediate: 50, any: 25 };
const REQUIRED_LEVEL_SCORES = { expert: 100, experienced: 75, intermediate: 50, any: 0 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['owner', 'ops_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { job_id } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id required' }, { status: 400 });

    // Load job and its requirements
    const [jobs, requiredSkills, requiredCredentials] = await Promise.all([
      base44.entities.Job.filter({ id: job_id }),
      base44.entities.JobRequiredSkill.filter({ job_id }),
      base44.entities.JobRequiredCredential.filter({ job_id }),
    ]);

    const job = jobs[0];
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Load approved contractors and their skills/credentials
    const [contractors, allSkills, contractorSkills, contractorCredentials] = await Promise.all([
      base44.entities.ContractorProfile.filter({ approval_status: 'approved', archived: false }),
      base44.entities.Skill.list(),
      base44.entities.ContractorSkill.list(),
      base44.entities.ContractorCredential.filter({ verification_status: 'verified', archived: false }),
    ]);

    const skillMap = Object.fromEntries(allSkills.map(s => [s.id, s]));

    // Score each contractor
    const scored = [];

    for (const contractor of contractors) {
      let score = 0;
      let disqualified = false;
      const reasons = [];

      const mySkills = contractorSkills.filter(cs => cs.contractor_id === contractor.id);
      const myCredentials = contractorCredentials.filter(cc => cc.contractor_id === contractor.id);

      // 1. Trade category match (20 pts)
      if (job.trade_category && contractor.primary_trade) {
        if (contractor.primary_trade.toLowerCase() === job.trade_category.toLowerCase()) {
          score += 20;
          reasons.push('Trade match: +20');
        }
      }

      // 2. Skills scoring (up to 40 pts)
      let skillScore = 0;
      let mandatorySkillsFailed = 0;
      for (const req of requiredSkills) {
        const mySkill = mySkills.find(cs => cs.skill_id === req.skill_id);
        if (!mySkill) {
          if (req.mandatory) mandatorySkillsFailed++;
          continue;
        }
        const profScore = PROFICIENCY_SCORES[mySkill.proficiency_level] || 0;
        const reqScore = REQUIRED_LEVEL_SCORES[req.required_level] || 0;
        if (profScore >= reqScore) {
          skillScore += profScore;
        } else if (req.mandatory) {
          mandatorySkillsFailed++;
        }
      }
      if (mandatorySkillsFailed > 0) {
        disqualified = true;
        reasons.push(`Missing ${mandatorySkillsFailed} mandatory skill(s)`);
      } else if (requiredSkills.length > 0) {
        const normalised = Math.min(40, (skillScore / (requiredSkills.length * 100)) * 40);
        score += normalised;
        reasons.push(`Skills: +${normalised.toFixed(1)}`);
      }

      // 3. Credentials scoring (up to 20 pts)
      let credScore = 0;
      let mandatoryCredsFailed = 0;
      for (const req of requiredCredentials) {
        const hasCred = myCredentials.some(cc => cc.credential_type_id === req.credential_type_id);
        if (!hasCred && req.mandatory) {
          mandatoryCredsFailed++;
        } else if (hasCred) {
          credScore += 1;
        }
      }
      if (mandatoryCredsFailed > 0) {
        disqualified = true;
        reasons.push(`Missing ${mandatoryCredsFailed} mandatory credential(s)`);
      } else if (requiredCredentials.length > 0) {
        const normalised = (credScore / requiredCredentials.length) * 20;
        score += normalised;
        reasons.push(`Credentials: +${normalised.toFixed(1)}`);
      }

      // 4. Distance scoring (up to 15 pts) — only if job has coordinates
      if (job.latitude && job.longitude && contractor.base_postcode) {
        // Use a rough postcode-to-lat/lng lookup isn't available without external API
        // If contractor has coordinates set (future), score by distance
        // For now, award partial points if within service radius as declared
        if (contractor.service_radius_miles) {
          score += 10;
          reasons.push('Service radius declared: +10');
        }
      }

      // 5. Availability (5 pts)
      if (contractor.availability_status === 'available') {
        score += 5;
        reasons.push('Available: +5');
      }

      // 6. Preferred contractor bonus (5 pts)
      if (contractor.preferred_contractor) {
        score += 5;
        reasons.push('Preferred contractor: +5');
      }

      // 7. Risk penalty
      if (contractor.internal_risk_status === 'high') score -= 10;
      if (contractor.internal_risk_status === 'blocked') disqualified = true;

      if (!disqualified) {
        scored.push({
          contractor_id: contractor.id,
          contractor,
          score: Math.round(Math.max(0, Math.min(100, score))),
          reasons,
        });
      }
    }

    // Sort by score desc
    scored.sort((a, b) => b.score - a.score);

    // Upsert JobMatch records for top 20
    const top = scored.slice(0, 20);
    const existingMatches = await base44.entities.JobMatch.filter({ job_id });
    const existingMap = Object.fromEntries(existingMatches.map(m => [m.contractor_id, m]));

    const upsertPromises = top.map(async ({ contractor_id, score, reasons }) => {
      const existing = existingMap[contractor_id];
      const data = {
        job_id,
        contractor_id,
        match_score: score,
        match_reasons: reasons.join('; '),
        status: 'suggested',
        generated_at: new Date().toISOString(),
      };
      if (existing) {
        return base44.entities.JobMatch.update(existing.id, data);
      } else {
        return base44.entities.JobMatch.create(data);
      }
    });

    await Promise.all(upsertPromises);

    // Update job status to ready_to_match if it was draft
    if (job.status === 'draft') {
      await base44.entities.Job.update(job_id, { status: 'ready_to_match' });
    }

    return Response.json({
      job_id,
      matches_generated: top.length,
      top_matches: top.slice(0, 5).map(t => ({
        contractor_id: t.contractor_id,
        name: t.contractor.trading_name || t.contractor.legal_name,
        score: t.score,
        reasons: t.reasons,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});