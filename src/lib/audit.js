// App-level audit recorder, bound to the Base44 AuditEvent entity.
// Usage:
//   import { recordAudit } from '@/lib/audit';
//   import { AUDIT_ACTIONS } from '@/domain/audit/auditService';
//   await recordAudit({ actorUserId, action: AUDIT_ACTIONS.CONTRACTOR_APPROVED,
//                       entityType: 'ContractorProfile', entityId, previousValues, newValues, reason });
//
// Server-side enforcement (RLS / functions) remains the source of truth; this
// records the event, it does not authorize the action.
import { base44 } from '@/api/base44Client';
import { createAuditRecorder } from '@/domain/audit/auditService';

const recorder = createAuditRecorder((record) => base44.entities.AuditEvent.create(record));

export const recordAudit = (input, opts) => recorder.record(input, opts);
