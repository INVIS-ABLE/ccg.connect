/**
 * RAMS / Method Statement domain — pure, testable building blocks for the Forms
 * feature.
 *
 * A "RAMS" combines a Method Statement (how the work is done safely) with a Risk
 * Assessment (a hazard table). A "Method Statement" is the method sections only.
 * Templates and filled documents share this content shape; the API stores it as
 * JSON and these helpers parse/validate/score it.
 *
 * This encodes structure and arithmetic only — it does not make safety
 * decisions. A high residual risk is surfaced, never auto-approved away.
 */
export type FormType = 'rams' | 'method_statement';

export interface SectionDef {
  key: string;
  title: string;
  required: boolean;
}

/** Method-statement narrative sections, in display order. */
const METHOD_SECTIONS: SectionDef[] = [
  { key: 'scope', title: 'Scope of works', required: true },
  { key: 'sequence', title: 'Sequence of operations', required: true },
  { key: 'plant_equipment', title: 'Plant & equipment', required: false },
  { key: 'substances', title: 'Hazardous substances (COSHH)', required: false },
  { key: 'access_egress', title: 'Access & egress', required: false },
  { key: 'ppe', title: 'PPE required', required: true },
  { key: 'training', title: 'Training & competence', required: false },
  { key: 'welfare', title: 'Welfare & first aid', required: false },
  { key: 'emergency', title: 'Emergency procedures', required: true },
  { key: 'environmental', title: 'Environmental considerations', required: false },
];

/** Both forms share the narrative sections; RAMS adds the hazard table on top. */
export function sectionDefs(): SectionDef[] {
  return METHOD_SECTIONS.map((s) => ({ ...s }));
}

/** RAMS additionally requires a populated hazard table. */
export function requiresHazards(type: FormType): boolean {
  return type === 'rams';
}

export interface Hazard {
  hazard: string;
  who_at_risk: string;
  /** Pre-control likelihood and severity, each 1–5. */
  likelihood: number;
  severity: number;
  controls: string;
  /** Post-control (residual) likelihood and severity, each 1–5. */
  residual_likelihood: number;
  residual_severity: number;
}

export interface RamsContent {
  sections: Record<string, string>;
  hazards: Hazard[];
}

export type RiskBand = 'low' | 'medium' | 'high';

export interface RiskRating {
  score: number;
  band: RiskBand;
}

const clamp15 = (n: unknown): number => {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseInt(n, 10) : NaN;
  if (!Number.isFinite(v)) return 0;
  return Math.min(5, Math.max(0, Math.round(v)));
};

/** 5×5 risk matrix: score = likelihood × severity, banded low/medium/high. */
export function riskRating(likelihood: unknown, severity: unknown): RiskRating {
  const score = clamp15(likelihood) * clamp15(severity);
  const band: RiskBand = score <= 4 ? 'low' : score <= 12 ? 'medium' : 'high';
  return { score, band };
}

export const initialRisk = (h: Hazard): RiskRating => riskRating(h.likelihood, h.severity);
export const residualRisk = (h: Hazard): RiskRating => riskRating(h.residual_likelihood, h.residual_severity);

/** A fresh, empty content scaffold for a new template or document. */
export function blankContent(): RamsContent {
  const sections: Record<string, string> = {};
  for (const s of sectionDefs()) sections[s.key] = '';
  return { sections, hazards: [] };
}

function normaliseHazard(raw: unknown): Hazard {
  const h = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    hazard: typeof h.hazard === 'string' ? h.hazard : '',
    who_at_risk: typeof h.who_at_risk === 'string' ? h.who_at_risk : '',
    likelihood: clamp15(h.likelihood),
    severity: clamp15(h.severity),
    controls: typeof h.controls === 'string' ? h.controls : '',
    residual_likelihood: clamp15(h.residual_likelihood),
    residual_severity: clamp15(h.residual_severity),
  };
}

/** Defensive parse of stored/incoming content into a well-formed RamsContent. */
export function parseContent(raw: unknown): RamsContent {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  }
  const src = (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>;
  const base = blankContent();
  const sections = { ...base.sections };
  const rawSections = (src.sections && typeof src.sections === 'object' ? src.sections : {}) as Record<string, unknown>;
  for (const key of Object.keys(sections)) {
    const v = rawSections[key];
    if (typeof v === 'string') sections[key] = v;
  }
  const hazards = Array.isArray(src.hazards) ? src.hazards.map(normaliseHazard) : [];
  return { sections, hazards };
}

export interface Completeness {
  complete: boolean;
  /** Human-readable labels of what is still missing. */
  missing: string[];
}

/**
 * Whether the document has the minimum content to be issued: every required
 * section filled, and (for RAMS) at least one hazard with a description and
 * control measure.
 */
export function validateCompleteness(content: RamsContent, type: FormType): Completeness {
  const missing: string[] = [];
  for (const s of sectionDefs()) {
    if (s.required && !(content.sections[s.key] ?? '').trim()) missing.push(s.title);
  }
  if (requiresHazards(type)) {
    const usable = content.hazards.filter((h) => h.hazard.trim() && h.controls.trim());
    if (usable.length === 0) missing.push('At least one hazard with control measures');
  }
  return { complete: missing.length === 0, missing };
}

/** The highest residual risk band present, for an at-a-glance document badge. */
export function highestResidualBand(content: RamsContent): RiskBand | null {
  let worst: RiskBand | null = null;
  const order: RiskBand[] = ['low', 'medium', 'high'];
  for (const h of content.hazards) {
    const b = residualRisk(h).band;
    if (worst === null || order.indexOf(b) > order.indexOf(worst)) worst = b;
  }
  return worst;
}
