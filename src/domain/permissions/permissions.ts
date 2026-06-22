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
