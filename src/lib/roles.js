// Role logic has a single source of truth in the typed domain module.
// This file keeps the legacy `@/lib/roles` import surface working and adds the
// UI-only status/colour maps.
import {
  isAdminRole,
  isOwnerRole,
  isContractorRole,
  isClientRole,
} from '@/domain/auth/roles';

export const ROLES = {
  OWNER: 'owner',
  OPS_ADMIN: 'ops_admin',
  CONTRACTOR: 'contractor',
  CLIENT: 'client',
};

export const isAdmin = isAdminRole;
export const isOwner = isOwnerRole;
export const isContractor = isContractorRole;
export const isClient = isClientRole;

export const JOB_STATUSES = {
  new_lead: { label: 'New Lead', color: 'bg-blue-100 text-blue-800' },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  ready_to_match: { label: 'Ready to Match', color: 'bg-purple-100 text-purple-800' },
  offers_sent: { label: 'Offers Sent', color: 'bg-yellow-100 text-yellow-800' },
  assigned: { label: 'Assigned', color: 'bg-orange-100 text-orange-800' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  on_hold: { label: 'On Hold', color: 'bg-amber-100 text-amber-800' },
  awaiting_contractor_action: { label: 'Awaiting Contractor', color: 'bg-yellow-100 text-yellow-800' },
  awaiting_client_approval: { label: 'Awaiting Client', color: 'bg-indigo-100 text-indigo-800' },
  snagging: { label: 'Snagging', color: 'bg-pink-100 text-pink-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

export const APPROVAL_STATUSES = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-600' },
};

export const CREDENTIAL_STATUSES = {
  awaiting_review: { label: 'Awaiting Review', color: 'bg-amber-100 text-amber-800' },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-800' },
  superseded: { label: 'Superseded', color: 'bg-gray-100 text-gray-600' },
};

export const TIMESHEET_STATUSES = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-800' },
  needs_correction: { label: 'Needs Correction', color: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  exported: { label: 'Exported', color: 'bg-purple-100 text-purple-800' },
  paid: { label: 'Paid', color: 'bg-teal-100 text-teal-800' },
  disputed: { label: 'Disputed', color: 'bg-red-100 text-red-800' },
};

export const INVOICE_STATUSES = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  sent: { label: 'Sent', color: 'bg-indigo-100 text-indigo-800' },
  paid: { label: 'Paid', color: 'bg-teal-100 text-teal-800' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
  disputed: { label: 'Disputed', color: 'bg-orange-100 text-orange-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};