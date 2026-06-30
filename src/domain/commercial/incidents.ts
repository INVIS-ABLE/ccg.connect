/**
 * Incident classification + escalation. Pure rules. Urgent incidents must bypass
 * ordinary messaging and notify the right CCG/site contacts immediately — this
 * decides which qualify; the caller performs the notification.
 */
export const INCIDENT_TYPES = [
  'accident',
  'near_miss',
  'safety_concern',
  'behaviour',
  'harassment',
  'discrimination',
  'fatigue',
  'welfare',
  'equipment',
  'client_complaint',
  'worker_complaint',
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_STATUSES = ['open', 'investigating', 'closed'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export function isIncidentType(v: unknown): v is IncidentType {
  return typeof v === 'string' && (INCIDENT_TYPES as readonly string[]).includes(v);
}
export function isIncidentSeverity(v: unknown): v is IncidentSeverity {
  return typeof v === 'string' && (INCIDENT_SEVERITIES as readonly string[]).includes(v);
}

/** Types where a serious report should be escalated immediately. */
const SAFETY_TYPES: readonly IncidentType[] = ['accident', 'near_miss', 'safety_concern', 'harassment', 'discrimination'];

/**
 * Whether an incident needs urgent (bypass-the-queue) escalation:
 *  - anything `critical`,
 *  - any `accident` (always),
 *  - a safety-related type at `high` severity.
 */
export function requiresUrgentEscalation(type: IncidentType, severity: IncidentSeverity): boolean {
  if (severity === 'critical') return true;
  if (type === 'accident') return true;
  if (severity === 'high' && SAFETY_TYPES.includes(type)) return true;
  return false;
}

const TYPE_LABELS: Record<IncidentType, string> = {
  accident: 'Accident',
  near_miss: 'Near miss',
  safety_concern: 'Safety concern',
  behaviour: 'Behaviour concern',
  harassment: 'Harassment',
  discrimination: 'Discrimination',
  fatigue: 'Fatigue',
  welfare: 'Welfare issue',
  equipment: 'Equipment issue',
  client_complaint: 'Client complaint',
  worker_complaint: 'Worker complaint',
};
export function incidentTypeLabel(type: string): string {
  return TYPE_LABELS[type as IncidentType] ?? type.replace(/_/g, ' ');
}
