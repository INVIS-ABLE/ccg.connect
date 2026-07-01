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
/**
 * Form types CCG can template. RAMS / Method Statement carry a hazard table;
 * the rest are structured site records (induction, diary, toolbox talk, quality,
 * handover, snagging, incident, plant/vehicle checks, completion) modelled on the
 * FSM/InspectionPress blueprints and recreated in our own stack.
 */
export const FORM_TYPES = [
  'rams',
  'method_statement',
  'site_induction',
  'daily_diary',
  'toolbox_talk',
  'quality_inspection',
  'handover',
  'snagging',
  'accident_report',
  'near_miss',
  'plant_inspection',
  'vehicle_check',
  'completion_report',
] as const;
export type FormType = (typeof FORM_TYPES)[number];

export const FORM_TYPE_LABEL: Record<FormType, string> = {
  rams: 'RAMS',
  method_statement: 'Method Statement',
  site_induction: 'Site Induction',
  daily_diary: 'Daily Site Diary',
  toolbox_talk: 'Toolbox Talk',
  quality_inspection: 'Quality Inspection',
  handover: 'Handover',
  snagging: 'Snagging',
  accident_report: 'Accident Report',
  near_miss: 'Near Miss',
  plant_inspection: 'Plant Inspection',
  vehicle_check: 'Vehicle Check',
  completion_report: 'Completion Report',
};

export const isFormType = (v: unknown): v is FormType =>
  typeof v === 'string' && (FORM_TYPES as readonly string[]).includes(v);

export interface FormTypeInfo {
  value: FormType;
  label: string;
}
export function listFormTypes(): FormTypeInfo[] {
  return FORM_TYPES.map((value) => ({ value, label: FORM_TYPE_LABEL[value] }));
}

export interface SectionDef {
  key: string;
  title: string;
  required: boolean;
}

/** Method-statement narrative sections, in display order (shared by RAMS). */
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

// Section scaffolds for the structured site records. Keys are stable (they're
// the stored content keys); titles/required drive the editor and completeness.
const SECTIONS: Record<FormType, SectionDef[]> = {
  rams: METHOD_SECTIONS,
  method_statement: METHOD_SECTIONS,
  site_induction: [
    { key: 'site_rules', title: 'Site rules', required: true },
    { key: 'hazards_briefed', title: 'Site hazards briefed', required: true },
    { key: 'emergency_procedures', title: 'Emergency procedures', required: true },
    { key: 'welfare', title: 'Welfare facilities', required: false },
    { key: 'ppe', title: 'PPE requirements', required: false },
    { key: 'sign_off', title: 'Operative sign-off', required: true },
  ],
  daily_diary: [
    { key: 'weather', title: 'Weather', required: false },
    { key: 'labour_on_site', title: 'Labour on site', required: true },
    { key: 'works_completed', title: 'Works completed', required: true },
    { key: 'delays', title: 'Delays / disruptions', required: false },
    { key: 'deliveries', title: 'Deliveries', required: false },
    { key: 'visitors', title: 'Visitors', required: false },
    { key: 'hs_observations', title: 'H&S observations', required: false },
  ],
  toolbox_talk: [
    { key: 'topic', title: 'Topic', required: true },
    { key: 'attendees', title: 'Attendees', required: true },
    { key: 'key_points', title: 'Key points covered', required: true },
    { key: 'questions_raised', title: 'Questions raised', required: false },
    { key: 'actions', title: 'Actions', required: false },
  ],
  quality_inspection: [
    { key: 'area_inspected', title: 'Area / element inspected', required: true },
    { key: 'checklist', title: 'Inspection checklist', required: true },
    { key: 'defects', title: 'Defects found', required: false },
    { key: 'result', title: 'Result', required: true },
  ],
  handover: [
    { key: 'works_completed', title: 'Works completed', required: true },
    { key: 'outstanding_items', title: 'Outstanding items', required: false },
    { key: 'snags', title: 'Snags', required: false },
    { key: 'documents', title: 'Documents handed over', required: false },
    { key: 'client_acceptance', title: 'Client acceptance', required: true },
  ],
  snagging: [
    { key: 'location', title: 'Location / area', required: true },
    { key: 'snag_description', title: 'Snag description', required: true },
    { key: 'responsible', title: 'Responsible', required: false },
    { key: 'target_date', title: 'Target date', required: false },
    { key: 'status', title: 'Status', required: true },
  ],
  accident_report: [
    { key: 'date_time', title: 'Date & time', required: true },
    { key: 'person_involved', title: 'Person(s) involved', required: true },
    { key: 'description', title: 'What happened', required: true },
    { key: 'injuries', title: 'Injuries', required: false },
    { key: 'immediate_actions', title: 'Immediate actions taken', required: true },
    { key: 'reported_to', title: 'Reported to', required: false },
  ],
  near_miss: [
    { key: 'date_time', title: 'Date & time', required: true },
    { key: 'description', title: 'What happened', required: true },
    { key: 'potential_consequences', title: 'Potential consequences', required: false },
    { key: 'actions', title: 'Actions to prevent recurrence', required: true },
  ],
  plant_inspection: [
    { key: 'plant_item', title: 'Plant / item', required: true },
    { key: 'checklist', title: 'Inspection checklist', required: true },
    { key: 'defects', title: 'Defects found', required: false },
    { key: 'safe_to_use', title: 'Safe to use?', required: true },
  ],
  vehicle_check: [
    { key: 'vehicle', title: 'Vehicle', required: true },
    { key: 'checklist', title: 'Check items', required: true },
    { key: 'defects', title: 'Defects found', required: false },
    { key: 'safe_to_use', title: 'Safe to use?', required: true },
  ],
  completion_report: [
    { key: 'summary_of_works', title: 'Summary of works', required: true },
    { key: 'final_checks', title: 'Final checks', required: false },
    { key: 'outstanding', title: 'Outstanding items', required: false },
    { key: 'client_sign_off', title: 'Client sign-off', required: true },
  ],
};

/** Narrative sections for a form type (defaults to the method-statement set). */
export function sectionDefs(type: FormType = 'rams'): SectionDef[] {
  return (SECTIONS[type] ?? METHOD_SECTIONS).map((s) => ({ ...s }));
}

/** Only RAMS carries the hazard/risk table on top of its sections. */
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

/** A fresh, empty content scaffold for a new template or document of a type. */
export function blankContent(type: FormType = 'rams'): RamsContent {
  const sections: Record<string, string> = {};
  for (const s of sectionDefs(type)) sections[s.key] = '';
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
  // Preserve every string section present, so content round-trips for any form
  // type without needing to know the type here (the editor renders the type's
  // scaffold from sectionDefs(type); stored values fill in by key).
  const sections: Record<string, string> = {};
  const rawSections = (src.sections && typeof src.sections === 'object' ? src.sections : {}) as Record<string, unknown>;
  for (const [key, v] of Object.entries(rawSections)) {
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
  for (const s of sectionDefs(type)) {
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
