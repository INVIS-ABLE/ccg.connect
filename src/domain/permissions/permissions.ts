/**
 * Record-level authorization for CCG Connect (Cloudflare-native backend).
 *
 * Pure functions encoding the non-negotiable security invariants (CLAUDE.md) so
 * they can be unit-tested and reused by the API Worker. The API loads the records
 * (and any related facts a decision needs) and calls these — it never trusts the
 * client. Functions are deliberately data-in / boolean-out and do not touch the
 * database.
 *
 * Covered here (core spine): UserProfile, Job, JobAssignment. Other entities are
 * added as their endpoints land.
 */
import type { AppRole } from '../auth/roles';
import { isAdminRole } from '../auth/roles';

/** The authenticated caller, resolved server-side from the session + UserProfile. */
export interface Principal {
  userId: string;
  role: AppRole;
  /** ContractorProfile.id when the caller is a contractor, else null. */
  contractorId: string | null;
  /** Client.id when the caller is a client, else null. */
  clientId: string | null;
  /**
   * Corporate accounts this client login may view in the commercial portal,
   * resolved from corporate_account_users. Empty/omitted for everyone else.
   */
  corporateAccountIds?: readonly string[];
}

export interface JobScope {
  client_id?: string | null;
}

export interface AssignmentScope {
  contractor_id: string;
  /** client_id of the assignment's job, when the caller is a client. */
  job_client_id?: string | null;
}

export interface OwnedRecord {
  user_id: string;
}

export const isAdmin = (p: Principal): boolean => isAdminRole(p.role);

// ── Commercial portal (corporate accounts) ─────────────────────────────────
/**
 * Invariant 2: a client may read a corporate account's commercial data only if
 * an admin has explicitly linked them to that account (corporate_account_users,
 * surfaced as `corporateAccountIds`). Admins see everything; contractors never.
 */
export function canAccessAccount(p: Principal, accountId: string | null | undefined): boolean {
  if (isAdmin(p)) return true;
  if (p.role !== 'client' || !accountId) return false;
  return (p.corporateAccountIds ?? []).includes(accountId);
}

// ── Jobs ──────────────────────────────────────────────────────────────────
// Invariant 12: assignment/management of jobs is an admin-only action.
export const canManageJobs = (p: Principal): boolean => isAdmin(p);

/**
 * Invariants 1 & 2: contractors see only jobs they are assigned to; clients see
 * only their own organisation's jobs; admins see everything.
 */
export function canReadJob(
  p: Principal,
  job: JobScope,
  ctx: { assignedContractorIds: readonly string[] },
): boolean {
  if (isAdmin(p)) return true;
  if (p.role === 'client') return p.clientId != null && job.client_id === p.clientId;
  if (p.role === 'contractor') {
    return p.contractorId != null && ctx.assignedContractorIds.includes(p.contractorId);
  }
  return false;
}

/**
 * Job delivery-team chat membership. A job chat contains the ops team and the
 * contractors assigned to that job — deliberately NOT the client, so the
 * hub-and-spoke rule (clients never reach contractors directly, invariants 1 & 2)
 * is preserved. Mirrors {@link canReadJob} minus the client branch.
 */
export function canAccessJobChat(
  p: Principal,
  ctx: { assignedContractorIds: readonly string[] },
): boolean {
  if (isAdmin(p)) return true;
  if (p.role === 'contractor') {
    return p.contractorId != null && ctx.assignedContractorIds.includes(p.contractorId);
  }
  return false;
}

/**
 * On-site check-in (QR clock-in). The same membership as a job delivery chat:
 * the ops team and the contractors assigned to the job. Clients never check in.
 */
export function canCheckInToJob(
  p: Principal,
  ctx: { assignedContractorIds: readonly string[] },
): boolean {
  return canAccessJobChat(p, ctx);
}

// ── Assignments ─────────────────────────────────────────────────────────────
export function canReadAssignment(p: Principal, a: AssignmentScope): boolean {
  if (isAdmin(p)) return true;
  if (p.role === 'contractor') return p.contractorId != null && a.contractor_id === p.contractorId;
  if (p.role === 'client') return p.clientId != null && a.job_client_id === p.clientId;
  return false;
}

// ── Profiles ─────────────────────────────────────────────────────────────────
/** Contractors/clients access only their own profile; admins may read any. */
export function canReadProfile(p: Principal, profile: OwnedRecord): boolean {
  return isAdmin(p) || profile.user_id === p.userId;
}
export function canWriteProfile(p: Principal, profile: OwnedRecord): boolean {
  return isAdmin(p) || profile.user_id === p.userId;
}

/**
 * Invariant 5: users cannot promote their own role. Role changes are an admin
 * action and never apply to the caller themselves through this path.
 */
export function canSetRole(p: Principal, targetUserId: string): boolean {
  return isAdmin(p) && targetUserId !== p.userId;
}

/**
 * Whether `p` may assign `newRole` to the user identified by `target`.
 *
 * Layers on top of `canSetRole` the least-privilege rules for staff/admin roles:
 *  - granting or revoking a privileged role (`owner`/`ops_admin`) is owner-only;
 *  - only an owner may change a user who is currently an `owner`;
 *  - no one changes their own role (invariant 5).
 */
export function canAssignRole(
  p: Principal,
  target: { user_id: string; role: AppRole },
  newRole: AppRole,
): boolean {
  if (!canSetRole(p, target.user_id)) return false;
  const touchesPrivileged =
    isAdminRole(newRole) || isAdminRole(target.role);
  if (touchesPrivileged && p.role !== 'owner') return false;
  return true;
}

/**
 * Whether `p` may create a brand-new staff login with `role`.
 *
 * Staff creation is the admin-only counterpart to public onboarding (which
 * refuses owner/ops_admin entirely). Any admin may create an `ops_admin`; only
 * an owner may create another `owner`.
 */
export function canCreateStaff(p: Principal, role: AppRole): boolean {
  if (!isAdmin(p)) return false;
  if (role === 'owner') return p.role === 'owner';
  return role === 'ops_admin';
}

// ── Contractors ──────────────────────────────────────────────────────────────
/** Approving/suspending/risk-rating contractors is an admin action. */
export const canManageContractors = (p: Principal): boolean => isAdmin(p);

/** A contractor may read/write only their own profile; admins any. */
export function canReadContractor(p: Principal, profile: OwnedRecord): boolean {
  return isAdmin(p) || profile.user_id === p.userId;
}
export function canWriteContractor(p: Principal, profile: OwnedRecord): boolean {
  return isAdmin(p) || profile.user_id === p.userId;
}

// ── Timesheets ───────────────────────────────────────────────────────────────
export interface TimesheetScope {
  contractor_id: string;
  /** client_id of the timesheet's job, when the caller is a client. */
  job_client_id?: string | null;
}

/** Approving/returning timesheets is an admin action. */
export const canManageTimesheets = (p: Principal): boolean => isAdmin(p);

/** A contractor may submit a timesheet only for themselves; admins for anyone. */
export function canSubmitTimesheet(p: Principal, contractorId: string): boolean {
  return isAdmin(p) || (p.role === 'contractor' && p.contractorId != null && p.contractorId === contractorId);
}

export function canReadTimesheet(p: Principal, ts: TimesheetScope): boolean {
  if (isAdmin(p)) return true;
  if (p.role === 'contractor') return p.contractorId != null && ts.contractor_id === p.contractorId;
  if (p.role === 'client') return p.clientId != null && ts.job_client_id === p.clientId;
  return false;
}

// ── Invoices ─────────────────────────────────────────────────────────────────
export interface InvoiceScope {
  contractor_id?: string | null;
  client_id?: string | null;
}

/** Creating/approving/sending invoices is an admin action. */
export const canManageInvoices = (p: Principal): boolean => isAdmin(p);

export function canReadInvoice(p: Principal, inv: InvoiceScope): boolean {
  if (isAdmin(p)) return true;
  if (p.role === 'contractor') return p.contractorId != null && inv.contractor_id === p.contractorId;
  if (p.role === 'client') return p.clientId != null && inv.client_id === p.clientId;
  return false;
}

// ── Credentials ──────────────────────────────────────────────────────────────
export interface CredentialScope {
  contractor_id: string;
}

/** Verifying/rejecting credentials is an admin action. */
export const canManageCredentials = (p: Principal): boolean => isAdmin(p);

export function canReadCredential(p: Principal, cr: CredentialScope): boolean {
  if (isAdmin(p)) return true;
  if (p.role === 'contractor') return p.contractorId != null && cr.contractor_id === p.contractorId;
  return false;
}
export function canWriteCredential(p: Principal, cr: CredentialScope): boolean {
  return isAdmin(p) || (p.role === 'contractor' && p.contractorId != null && cr.contractor_id === p.contractorId);
}

// ── Leads (invariant 4) ──────────────────────────────────────────────────────
/** Anyone may create a Lead (public intake); only admins may ever read them. */
export const canReadLeads = (p: Principal): boolean => isAdmin(p);

// ── Direct messages (1:1 chat) ───────────────────────────────────────────────
/**
 * Hub-and-spoke messaging: a conversation is permitted only if at least one
 * participant is an admin (owner/ops_admin). This keeps invariants 1 & 2 intact —
 * contractors and clients may message the ops team but never each other, and
 * clients never reach contractors directly.
 */
export function canMessageRoles(a: AppRole, b: AppRole): boolean {
  return isAdminRole(a) || isAdminRole(b);
}

/** Whether the caller may start/continue a 1:1 chat with someone of `recipientRole`. */
export function canStartConversation(p: Principal, recipientRole: AppRole): boolean {
  return canMessageRoles(p.role, recipientRole);
}

export interface ConversationScope {
  a_user_id: string | null;
  b_user_id: string | null;
}

/** Only the two participants may read or post in a conversation. */
export function isConversationParticipant(p: Principal, convo: ConversationScope): boolean {
  return convo.a_user_id === p.userId || convo.b_user_id === p.userId;
}

// ── Field redaction ──────────────────────────────────────────────────────────
/** Job fields that must never reach a non-admin response (invariant 6). */
export const INTERNAL_JOB_FIELDS = ['internal_notes', 'private_admin_notes'] as const;
/** ContractorProfile/Client fields that must never reach a non-admin response. */
export const INTERNAL_PROFILE_FIELDS = ['private_admin_notes', 'internal_risk_status'] as const;

/**
 * Invariant 6: strip internal/private fields from a record for non-admin callers.
 * Returns the record unchanged for admins.
 */
export function redactForRole<T extends Record<string, unknown>>(
  p: Principal,
  record: T,
  internalFields: readonly string[],
): T {
  if (isAdmin(p)) return record;
  const copy = { ...record } as Record<string, unknown>;
  for (const field of internalFields) delete copy[field];
  return copy as T;
}
