import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Haversine distance in miles
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// UK postcode geocoding via postcodes.io (free, no API key)
async function geocodePostcode(postcode) {
  if (!postcode) return null;
  const clean = postcode.replace(/\s+/g, '').toUpperCase();
  const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 200 || !data.result) return null;
  return { lat: data.result.latitude, lng: data.result.longitude };
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

    // Geocode job site if no coordinates stored
    let jobLat = job.latitude;
    let jobLng = job.longitude;
    if ((!jobLat || !jobLng) && job.site_postcode) {
      const coords = await geocodePostcode(job.site_postcode);
      if (coords) { jobLat = coords.lat; jobLng = coords.lng; }
    }

    // Load approved contractors + their data + availability
    const today = new Date().toISOString().split('T')[0];
    const startDate = job.start_date || today;

    const [contractors, allSkills, contractorSkills, contractorCredentials, availabilities] = await Promise.all([
      base44.entities.ContractorProfile.filter({ approval_status: 'approved', archived: false }),
      base44.entities.Skill.list(),
      base44.entities.ContractorSkill.list(),
      base44.entities.ContractorCredential.filter({ verification_status: 'verified', archived: false }),
      base44.entities.ContractorAvailability.filter({}), // will filter per contractor below
    ]);

    // Geocode all contractor postcodes in parallel (limit to avoid rate limiting)
    const contractorCoords = {};
    const geocodeBatch = contractors.slice(0, 50).map(async (c) => {
      if (c.base_postcode) {
        const coords = await geocodePostcode(c.base_postcode);
        if (coords) contractorCoords[c.id] = coords;
      }
    });
    await Promise.all(geocodeBatch);

    // Score each contractor
    const scored = [];

    for (const contractor of contractors) {
      let score = 0;
      let disqualified = false;
      const reasons = [];

      const mySkills = contractorSkills.filter(cs => cs.contractor_id === contractor.id);
      const myCredentials = contractorCredentials.filter(cc => cc.contractor_id === contractor.id);
      const myAvailability = availabilities.filter(a => a.contractor_id === contractor.id);

      // 1. Trade category match (15 pts)
      if (job.trade_category && contractor.primary_trade) {
        if (contractor.primary_trade.toLowerCase() === job.trade_category.toLowerCase()) {
          score += 15;
          reasons.push('Trade match: +15');
        }
      }

      // 2. Skills scoring (up to 35 pts)
      if (requiredSkills.length > 0) {
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
        } else {
          const normalised = Math.min(35, (skillScore / (requiredSkills.length * 100)) * 35);
          score += normalised;
          reasons.push(`Skills: +${normalised.toFixed(1)}`);
        }
      }

      // 3. Credentials scoring (up to 20 pts)
      if (requiredCredentials.length > 0) {
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
        } else {
          const normalised = (credScore / requiredCredentials.length) * 20;
          score += normalised;
          reasons.push(`Credentials: +${normalised.toFixed(1)}`);
        }
      }

      // 4. Proximity scoring (up to 20 pts) — real distance via geocoded postcodes
      let distanceMiles = null;
      if (jobLat && jobLng) {
        const cCoords = contractorCoords[contractor.id];
        if (cCoords) {
          distanceMiles = haversineDistance(jobLat, jobLng, cCoords.lat, cCoords.lng);
          const maxRadius = contractor.service_radius_miles || contractor.maximum_travel_miles || 30;
          if (distanceMiles > maxRadius) {
            // Outside declared travel range — disqualify unless no radius set
            if (contractor.service_radius_miles) {
              disqualified = true;
              reasons.push(`Outside service radius (${distanceMiles.toFixed(1)}mi > ${maxRadius}mi)`);
            }
          } else {
            // Score: 20 pts for 0 miles, tapering to 0 at maxRadius
            const proximityScore = Math.max(0, 20 * (1 - distanceMiles / maxRadius));
            score += proximityScore;
            reasons.push(`Distance ${distanceMiles.toFixed(1)}mi: +${proximityScore.toFixed(1)}`);
          }
        } else if (contractor.service_radius_miles) {
          // No geocode available but has declared radius — partial credit
          score += 8;
          reasons.push('Service radius declared: +8');
        }
      }

      // 5. Availability check (10 pts)
      // Check if contractor has any 'unavailable' or 'holiday' block covering the job start date
      const isBlocked = myAvailability.some(a => {
        if (!['unavailable', 'holiday'].includes(a.availability_type)) return false;
        const aStart = a.start_date;
        const aEnd = a.end_date || a.start_date;
        return startDate >= aStart && startDate <= aEnd;
      });

      if (isBlocked) {
        disqualified = true;
        reasons.push('Unavailable on job start date');
      } else if (contractor.availability_status === 'available') {
        score += 10;
        reasons.push('Available: +10');
      } else if (contractor.availability_status === 'partially_available') {
        score += 5;
        reasons.push('Partially available: +5');
      }

      // 6. Preferred contractor bonus (5 pts)
      if (contractor.preferred_contractor) {
        score += 5;
        reasons.push('Preferred: +5');
      }

      // 7. Risk penalty
      if (contractor.internal_risk_status === 'high') { score -= 10; reasons.push('High risk: -10'); }
      if (contractor.internal_risk_status === 'blocked') disqualified = true;

      if (!disqualified) {
        scored.push({
          contractor_id: contractor.id,
          contractor,
          score: Math.round(Math.max(0, Math.min(100, score))),
          reasons,
          distance_miles: distanceMiles ? Math.round(distanceMiles * 10) / 10 : null,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 20);

    // Upsert JobMatch records
    const existingMatches = await base44.entities.JobMatch.filter({ job_id });
    const existingMap = Object.fromEntries(existingMatches.map(m => [m.contractor_id, m]));

    await Promise.all(top.map(({ contractor_id, score, reasons, distance_miles }) => {
      const data = {
        job_id,
        contractor_id,
        match_score: score,
        match_reasons: reasons.join('; '),
        distance_miles,
        status: 'suggested',
        generated_at: new Date().toISOString(),
      };
      const existing = existingMap[contractor_id];
      return existing
        ? base44.entities.JobMatch.update(existing.id, data)
        : base44.entities.JobMatch.create(data);
    }));

    if (job.status === 'draft') {
      await base44.entities.Job.update(job_id, { status: 'ready_to_match' });
    }

    return Response.json({
      job_id,
      matches_generated: top.length,
      job_geocoded: !!(jobLat && jobLng),
      top_matches: top.slice(0, 5).map(t => ({
        contractor_id: t.contractor_id,
        name: t.contractor.trading_name || t.contractor.legal_name,
        score: t.score,
        distance_miles: t.distance_miles,
        reasons: t.reasons,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});