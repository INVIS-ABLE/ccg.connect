/**
 * Central audit service.
 *
 * Audit invariant: records are append-only and every sensitive action must
 * generate one. This module is the single place that shapes an audit record,
 * redacts secrets/PII, and stamps a correlation id. It is deliberately free of
 * SDK imports so it can be unit-tested; callers inject a `sink` that persists
 * the built record (in the app this is `base44.entities.AuditEvent.create`).
 */

/** Canonical audit actions. Use these constants — never free-text actions. */
export const AUDIT_ACTIONS = {
  CONTRACTOR_APPROVED: 'contractor.approved',
  CONTRACTOR_REJECTED: 'contractor.rejected',
  CONTRACTOR_SUSPENDED: 'contractor.suspended',
  CREDENTIAL_VERIFIED: 'credential.verified',
  CREDENTIAL_REJECTED: 'credential.rejected',
  CREDENTIAL_SUPERSEDED: 'credential.superseded',
  CREDENTIAL_SHARED: 'credential.shared',
  JOB_ASSIGNED: 'job.assigned',
  OFFER_SENT: 'offer.sent',
  TIMESHEET_APPROVED: 'timesheet.approved',
  TIMESHEET_RETURNED: 'timesheet.returned',
  INVOICE_STATUS_CHANGED: 'invoice.status_changed',
  CLIENT_SIGN_OFF: 'job.client_sign_off',
  ROLE_CHANGED: 'user.role_changed',
  DATA_EXPORTED: 'data.exported',
  RECORD_ARCHIVED: 'record.archived',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | (string & {});

export interface AuditEventInput {
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  reason?: string | null;
  correlationId?: string | null;
}

/** Shape persisted to the `AuditEvent` entity (stable field names). */
export interface AuditEventRecord {
  actor_user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  previous_values?: string;
  new_values?: string;
  timestamp: string;
  reason?: string;
  correlation_id: string;
}

/**
 * Keys whose values must never be written into an audit payload, matched
 * case-insensitively as substrings. Covers secrets and private file handles.
 */
const REDACT_KEY_PATTERNS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'authorization',
  'file_url',
  'attachment_url',
  'thumbnail_url',
];

const REDACTED = '[REDACTED]';

function shouldRedact(key: string): boolean {
  const k = key.toLowerCase();
  return REDACT_KEY_PATTERNS.some((p) => k.includes(p));
}

/** Recursively redact sensitive keys from a plain object/array tree. */
export function redactValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => redactValues(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = shouldRedact(k) ? REDACTED : redactValues(v);
    }
    return out as unknown as T;
  }
  return value;
}

export interface BuildOptions {
  /** Injectable for deterministic tests. Defaults to wall clock. */
  now?: () => Date;
  /** Injectable for deterministic tests. Defaults to crypto/random. */
  generateCorrelationId?: () => string;
}

function defaultCorrelationId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Build (but do not persist) a redacted, well-formed audit record. */
export function buildAuditRecord(input: AuditEventInput, opts: BuildOptions = {}): AuditEventRecord {
  if (!input.action) throw new Error('audit: action is required');
  if (!input.entityType) throw new Error('audit: entityType is required');

  const now = opts.now ?? (() => new Date());
  const genId = opts.generateCorrelationId ?? defaultCorrelationId;

  const record: AuditEventRecord = {
    action: input.action,
    entity_type: input.entityType,
    timestamp: now().toISOString(),
    correlation_id: input.correlationId || genId(),
  };

  if (input.actorUserId) record.actor_user_id = input.actorUserId;
  if (input.entityId) record.entity_id = input.entityId;
  if (input.reason) record.reason = input.reason;
  if (input.previousValues != null) {
    record.previous_values = JSON.stringify(redactValues(input.previousValues));
  }
  if (input.newValues != null) {
    record.new_values = JSON.stringify(redactValues(input.newValues));
  }

  return record;
}

export type AuditSink = (record: AuditEventRecord) => Promise<unknown>;

export interface AuditRecorder {
  record: (input: AuditEventInput, opts?: BuildOptions) => Promise<AuditEventRecord>;
}

/**
 * Create a recorder bound to a persistence sink. Audit failures are logged but
 * never thrown to the caller — a failed audit must not silently abort the user's
 * primary action, but it must also never pass unnoticed.
 */
export function createAuditRecorder(sink: AuditSink): AuditRecorder {
  return {
    async record(input, opts) {
      const rec = buildAuditRecord(input, opts);
      try {
        await sink(rec);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[audit] failed to persist audit event', {
          action: rec.action,
          entity_type: rec.entity_type,
          correlation_id: rec.correlation_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return rec;
    },
  };
}
