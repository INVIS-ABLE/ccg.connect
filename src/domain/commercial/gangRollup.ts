/**
 * Gang roll-up — aggregate a gang's members into the figures a dispatcher needs
 * before deploying the team: combined qualifications, availability, right-to-work
 * status, and a pay-cost / charge / margin summary.
 *
 * Pure and penny-rounded. Reserves are backups: they count toward the roster and
 * availability, but NOT toward the deployable pay cost (only leader + permanent
 * members are the working core that gets charged). A gang grouping is never a
 * compliance shortcut — per-member checks still apply elsewhere.
 */

export type GangRole = 'leader' | 'permanent' | 'reserve';

export interface RollupCard {
  card_type: string;
  verification_status: string;
}

export interface RollupMember {
  role: GangRole | string | null;
  right_to_work_status: string;
  available_from: string | null; // ISO yyyy-mm-dd
  day_rate: number | null;
  cards: RollupCard[];
}

export interface GangRollup {
  totalMembers: number;
  coreMembers: number; // leader + permanent
  reserveMembers: number;
  /** Sorted, de-duplicated verified card/qualification types across all members. */
  qualifications: string[];
  availableNow: number;
  /** Earliest future availability among members not available today, else null. */
  earliestAvailable: string | null;
  rtwValid: number; // members with right_to_work_status === 'checked'
  payCostPerDay: number; // Σ day_rate over core members (nulls treated as 0)
  chargePerDay: number | null; // the gang's usual day rate, if set
  marginPerDay: number | null; // charge − cost, when charge is set
  marginPct: number | null; // margin / charge × 100, when charge > 0
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const isCore = (role: RollupMember['role']) => role === 'leader' || role === 'permanent';

/**
 * @param members  the gang's members joined to their worker passport
 * @param chargePerDay  the gang's usual day rate (client charge), or null
 * @param today  reference date for availability (defaults to now)
 */
export function computeGangRollup(
  members: RollupMember[],
  chargePerDay: number | null,
  today: Date = new Date(),
): GangRollup {
  const todayIso = today.toISOString().slice(0, 10);

  const quals = new Set<string>();
  let availableNow = 0;
  let rtwValid = 0;
  let earliestAvailable: string | null = null;
  let payCostPerDay = 0;
  let coreMembers = 0;
  let reserveMembers = 0;

  for (const m of members) {
    for (const card of m.cards) {
      if (card.verification_status === 'verified' && card.card_type.trim()) {
        quals.add(card.card_type.trim());
      }
    }

    const availNow = !m.available_from || m.available_from <= todayIso;
    if (availNow) availableNow += 1;
    else if (earliestAvailable === null || m.available_from! < earliestAvailable) {
      earliestAvailable = m.available_from;
    }

    if (m.right_to_work_status === 'checked') rtwValid += 1;

    if (m.role === 'reserve') reserveMembers += 1;
    if (isCore(m.role)) {
      coreMembers += 1;
      if (typeof m.day_rate === 'number' && Number.isFinite(m.day_rate)) payCostPerDay += m.day_rate;
    }
  }

  const cost = r2(payCostPerDay);
  const charge = typeof chargePerDay === 'number' && Number.isFinite(chargePerDay) ? r2(chargePerDay) : null;
  const marginPerDay = charge !== null ? r2(charge - cost) : null;
  const marginPct = charge !== null && charge > 0 ? r2((marginPerDay! / charge) * 100) : null;

  return {
    totalMembers: members.length,
    coreMembers,
    reserveMembers,
    qualifications: [...quals].sort((a, b) => a.localeCompare(b)),
    availableNow,
    earliestAvailable,
    rtwValid,
    payCostPerDay: cost,
    chargePerDay: charge,
    marginPerDay,
    marginPct,
  };
}
