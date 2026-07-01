/**
 * Commercial request types — the different kinds of work CCG is asked to
 * resource, captured at intake. This categorises *what is being asked for*
 * (an early enquiry, firm individual labour, a full gang, a priced subcontract
 * package, a site visit, or an urgent replacement) and is distinct from the
 * employment model (how the supply is contracted, see employmentModels.ts).
 *
 * Descriptive only — it never changes authorization or tax treatment. It offers
 * a sensible default urgency the intake form can pre-fill, which the user can
 * always override.
 */

export const REQUEST_TYPES = [
  'client_enquiry',
  'labour_request',
  'gang_request',
  'subcontract_package',
  'site_visit',
  'emergency_replacement',
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export type Urgency = 'low' | 'medium' | 'high' | 'emergency';

export interface RequestTypeInfo {
  value: RequestType;
  label: string;
  summary: string;
  /** Suggested urgency to pre-fill at intake (user-overridable). */
  defaultUrgency: Urgency;
  /** Whether a worker headcount is meaningful (false for enquiries / site visits). */
  needsHeadcount: boolean;
}

const INFO: Record<RequestType, RequestTypeInfo> = {
  client_enquiry: {
    value: 'client_enquiry',
    label: 'Client enquiry',
    summary: 'An early enquiry being qualified — not yet a firm order.',
    defaultUrgency: 'low',
    needsHeadcount: false,
  },
  labour_request: {
    value: 'labour_request',
    label: 'Labour request',
    summary: 'A firm request for individual operatives on a site.',
    defaultUrgency: 'medium',
    needsHeadcount: true,
  },
  gang_request: {
    value: 'gang_request',
    label: 'Gang request',
    summary: 'A request for a full gang / team under a gang leader.',
    defaultUrgency: 'medium',
    needsHeadcount: true,
  },
  subcontract_package: {
    value: 'subcontract_package',
    label: 'Subcontract package',
    summary: 'A priced scope of work delivered as a subcontract package.',
    defaultUrgency: 'medium',
    needsHeadcount: false,
  },
  site_visit: {
    value: 'site_visit',
    label: 'Site visit',
    summary: 'A survey or assessment visit before resourcing.',
    defaultUrgency: 'medium',
    needsHeadcount: false,
  },
  emergency_replacement: {
    value: 'emergency_replacement',
    label: 'Emergency replacement',
    summary: 'An urgent backfill for an absence on an active deployment.',
    defaultUrgency: 'emergency',
    needsHeadcount: true,
  },
};

export function isRequestType(value: unknown): value is RequestType {
  return typeof value === 'string' && (REQUEST_TYPES as readonly string[]).includes(value);
}

export function requestTypeInfo(value: RequestType): RequestTypeInfo {
  return INFO[value];
}

export function listRequestTypes(): RequestTypeInfo[] {
  return REQUEST_TYPES.map((t) => INFO[t]);
}

/** Suggested urgency for a type, or 'medium' when the type is unknown/unset. */
export function defaultUrgencyFor(value: unknown): Urgency {
  return isRequestType(value) ? INFO[value].defaultUrgency : 'medium';
}
