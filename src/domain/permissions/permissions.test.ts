import { describe, it, expect } from 'vitest';
import {
  type Principal,
  canManageJobs,
  canAccessAccount,
  canReadJob,
  canReadAssignment,
  canReadProfile,
  canWriteProfile,
  canSetRole,
  canAssignRole,
  canCreateStaff,
  canAccessJobChat,
  canCheckInToJob,
  canManageContractors,
  canReadContractor,
  canReadLeads,
  canSubmitTimesheet,
  canReadTimesheet,
  canManageTimesheets,
  canManageInvoices,
  canReadInvoice,
  canManageCredentials,
  canReadCredential,
  canWriteCredential,
  redactForRole,
  INTERNAL_JOB_FIELDS,
  canMessageRoles,
  canStartConversation,
  isConversationParticipant,
} from './permissions';

const owner: Principal = { userId: 'u-owner', role: 'owner', contractorId: null, clientId: null };
const ops: Principal = { userId: 'u-ops', role: 'ops_admin', contractorId: null, clientId: null };
const contractor: Principal = {
  userId: 'u-con',
  role: 'contractor',
  contractorId: 'c-1',
  clientId: null,
};
const otherContractor: Principal = {
  userId: 'u-con2',
  role: 'contractor',
  contractorId: 'c-2',
  clientId: null,
};
const client: Principal = { userId: 'u-cli', role: 'client', contractorId: null, clientId: 'cl-1' };
const otherClient: Principal = {
  userId: 'u-cli2',
  role: 'client',
  contractorId: null,
  clientId: 'cl-2',
};

describe('canManageJobs (invariant 12)', () => {
  it('allows admins only', () => {
    expect(canManageJobs(owner)).toBe(true);
    expect(canManageJobs(ops)).toBe(true);
    expect(canManageJobs(contractor)).toBe(false);
    expect(canManageJobs(client)).toBe(false);
  });
});

describe('canAccessAccount (invariant 2: commercial portal scoping)', () => {
  const linkedClient: Principal = { ...client, corporateAccountIds: ['acc-1', 'acc-2'] };
  it('admins can access any account', () => {
    expect(canAccessAccount(owner, 'acc-9')).toBe(true);
    expect(canAccessAccount(ops, 'acc-9')).toBe(true);
  });
  it('a client can access only explicitly-linked accounts', () => {
    expect(canAccessAccount(linkedClient, 'acc-1')).toBe(true);
    expect(canAccessAccount(linkedClient, 'acc-2')).toBe(true);
    expect(canAccessAccount(linkedClient, 'acc-3')).toBe(false);
  });
  it('a client with no links (or missing field) is denied', () => {
    expect(canAccessAccount(client, 'acc-1')).toBe(false);
    expect(canAccessAccount({ ...client, corporateAccountIds: [] }, 'acc-1')).toBe(false);
  });
  it('contractors are always denied, and a null account id is denied', () => {
    expect(canAccessAccount(contractor, 'acc-1')).toBe(false);
    expect(canAccessAccount(linkedClient, null)).toBe(false);
  });
});

describe('canReadJob (invariants 1 & 2)', () => {
  const job = { client_id: 'cl-1' };

  it('admins read any job', () => {
    expect(canReadJob(owner, job, { assignedContractorIds: [] })).toBe(true);
    expect(canReadJob(ops, job, { assignedContractorIds: [] })).toBe(true);
  });

  it('client reads only their own org jobs', () => {
    expect(canReadJob(client, job, { assignedContractorIds: [] })).toBe(true);
    expect(canReadJob(otherClient, job, { assignedContractorIds: [] })).toBe(false);
  });

  it('contractor reads only jobs they are assigned to', () => {
    expect(canReadJob(contractor, job, { assignedContractorIds: ['c-1'] })).toBe(true);
    expect(canReadJob(contractor, job, { assignedContractorIds: ['c-2'] })).toBe(false);
    expect(canReadJob(otherContractor, job, { assignedContractorIds: ['c-1'] })).toBe(false);
  });

  it('denies a contractor with no contractorId even if id list is empty-matching', () => {
    const orphan: Principal = { ...contractor, contractorId: null };
    expect(canReadJob(orphan, job, { assignedContractorIds: [] })).toBe(false);
  });

  it('denies a client with no clientId', () => {
    const orphan: Principal = { ...client, clientId: null };
    expect(canReadJob(orphan, { client_id: null }, { assignedContractorIds: [] })).toBe(false);
  });
});

describe('direct messaging (invariants 1 & 2 — hub-and-spoke)', () => {
  it('admins may message any role (and each other)', () => {
    expect(canStartConversation(owner, 'contractor')).toBe(true);
    expect(canStartConversation(owner, 'client')).toBe(true);
    expect(canStartConversation(ops, 'contractor')).toBe(true);
    expect(canStartConversation(ops, 'owner')).toBe(true);
  });

  it('contractors and clients may only message the ops team', () => {
    expect(canStartConversation(contractor, 'owner')).toBe(true);
    expect(canStartConversation(contractor, 'ops_admin')).toBe(true);
    expect(canStartConversation(client, 'owner')).toBe(true);
    // ...but never each other
    expect(canStartConversation(contractor, 'contractor')).toBe(false);
    expect(canStartConversation(contractor, 'client')).toBe(false);
    expect(canStartConversation(client, 'contractor')).toBe(false);
    expect(canStartConversation(client, 'client')).toBe(false);
  });

  it('canMessageRoles is symmetric (true iff one side is admin)', () => {
    expect(canMessageRoles('contractor', 'owner')).toBe(true);
    expect(canMessageRoles('owner', 'contractor')).toBe(true);
    expect(canMessageRoles('contractor', 'client')).toBe(false);
    expect(canMessageRoles('client', 'contractor')).toBe(false);
  });

  it('only the two participants may access a conversation', () => {
    const convo = { a_user_id: 'u-owner', b_user_id: 'u-con' };
    expect(isConversationParticipant(owner, convo)).toBe(true);
    expect(isConversationParticipant(contractor, convo)).toBe(true);
    expect(isConversationParticipant(client, convo)).toBe(false);
    expect(isConversationParticipant(otherContractor, convo)).toBe(false);
  });
});

describe('canReadAssignment', () => {
  it('admins read any', () => {
    expect(canReadAssignment(owner, { contractor_id: 'c-9' })).toBe(true);
  });
  it('contractor reads only their own assignments', () => {
    expect(canReadAssignment(contractor, { contractor_id: 'c-1' })).toBe(true);
    expect(canReadAssignment(contractor, { contractor_id: 'c-2' })).toBe(false);
  });
  it('client reads assignments only for their own jobs', () => {
    expect(canReadAssignment(client, { contractor_id: 'c-1', job_client_id: 'cl-1' })).toBe(true);
    expect(canReadAssignment(client, { contractor_id: 'c-1', job_client_id: 'cl-2' })).toBe(false);
  });
});

describe('profile access (own-only for non-admins)', () => {
  const profile = { user_id: 'u-con' };
  it('owner of the profile can read/write', () => {
    expect(canReadProfile(contractor, profile)).toBe(true);
    expect(canWriteProfile(contractor, profile)).toBe(true);
  });
  it('a different non-admin cannot', () => {
    expect(canReadProfile(otherContractor, profile)).toBe(false);
    expect(canWriteProfile(otherContractor, profile)).toBe(false);
  });
  it('admins can read/write any profile', () => {
    expect(canReadProfile(ops, profile)).toBe(true);
    expect(canWriteProfile(ops, profile)).toBe(true);
  });
});

describe('canSetRole (invariant 5: no self-promotion)', () => {
  it('admins may set another user’s role', () => {
    expect(canSetRole(owner, 'u-con')).toBe(true);
  });
  it('admins may NOT change their own role', () => {
    expect(canSetRole(owner, 'u-owner')).toBe(false);
  });
  it('non-admins may never set roles', () => {
    expect(canSetRole(contractor, 'u-con2')).toBe(false);
    expect(canSetRole(client, 'u-cli2')).toBe(false);
  });
});

describe('canAccessJobChat (delivery-team room: ops + assigned contractors, no clients)', () => {
  it('admins can always access a job chat', () => {
    expect(canAccessJobChat(owner, { assignedContractorIds: [] })).toBe(true);
    expect(canAccessJobChat(ops, { assignedContractorIds: ['c-9'] })).toBe(true);
  });
  it('a contractor assigned to the job can access it', () => {
    expect(canAccessJobChat(contractor, { assignedContractorIds: ['c-1', 'c-2'] })).toBe(true);
  });
  it('a contractor NOT assigned to the job cannot access it', () => {
    expect(canAccessJobChat(contractor, { assignedContractorIds: ['c-2'] })).toBe(false);
    expect(canAccessJobChat(contractor, { assignedContractorIds: [] })).toBe(false);
  });
  it('clients are never in a job delivery chat (hub-and-spoke preserved)', () => {
    expect(canAccessJobChat(client, { assignedContractorIds: ['c-1'] })).toBe(false);
  });
});

describe('canCheckInToJob (QR site check-in: ops + assigned contractors)', () => {
  it('an assigned contractor may check in; an unassigned one may not', () => {
    expect(canCheckInToJob(contractor, { assignedContractorIds: ['c-1'] })).toBe(true);
    expect(canCheckInToJob(contractor, { assignedContractorIds: ['c-2'] })).toBe(false);
  });
  it('admins may check in (e.g. recording a manual arrival); clients never can', () => {
    expect(canCheckInToJob(owner, { assignedContractorIds: [] })).toBe(true);
    expect(canCheckInToJob(client, { assignedContractorIds: ['c-1'] })).toBe(false);
  });
});

describe('canAssignRole (least privilege for staff roles)', () => {
  const contractorTarget = { user_id: 'u-con', role: 'contractor' as const };
  const opsTarget = { user_id: 'u-ops2', role: 'ops_admin' as const };
  const ownerTarget = { user_id: 'u-owner2', role: 'owner' as const };

  it('any admin may set a contractor↔client role', () => {
    expect(canAssignRole(owner, contractorTarget, 'client')).toBe(true);
    expect(canAssignRole(ops, contractorTarget, 'client')).toBe(true);
  });
  it('only owner may grant a privileged role', () => {
    expect(canAssignRole(owner, contractorTarget, 'ops_admin')).toBe(true);
    expect(canAssignRole(ops, contractorTarget, 'ops_admin')).toBe(false);
    expect(canAssignRole(ops, contractorTarget, 'owner')).toBe(false);
  });
  it('only owner may change a user who is already an admin', () => {
    expect(canAssignRole(ops, opsTarget, 'client')).toBe(false);
    expect(canAssignRole(owner, opsTarget, 'client')).toBe(true);
    expect(canAssignRole(ops, ownerTarget, 'client')).toBe(false);
  });
  it('no one may change their own role (invariant 5)', () => {
    expect(canAssignRole(owner, { user_id: 'u-owner', role: 'owner' }, 'ops_admin')).toBe(false);
  });
  it('non-admins may never assign roles', () => {
    expect(canAssignRole(contractor, contractorTarget, 'client')).toBe(false);
    expect(canAssignRole(client, contractorTarget, 'client')).toBe(false);
  });
});

describe('canCreateStaff (admin-only staff logins)', () => {
  it('any admin may create an ops_admin', () => {
    expect(canCreateStaff(owner, 'ops_admin')).toBe(true);
    expect(canCreateStaff(ops, 'ops_admin')).toBe(true);
  });
  it('only owner may create another owner', () => {
    expect(canCreateStaff(owner, 'owner')).toBe(true);
    expect(canCreateStaff(ops, 'owner')).toBe(false);
  });
  it('staff creation never mints contractor/client roles', () => {
    expect(canCreateStaff(owner, 'contractor')).toBe(false);
    expect(canCreateStaff(owner, 'client')).toBe(false);
  });
  it('non-admins may never create staff', () => {
    expect(canCreateStaff(contractor, 'ops_admin')).toBe(false);
    expect(canCreateStaff(client, 'ops_admin')).toBe(false);
  });
});

describe('contractor management', () => {
  it('only admins manage contractors', () => {
    expect(canManageContractors(owner)).toBe(true);
    expect(canManageContractors(contractor)).toBe(false);
    expect(canManageContractors(client)).toBe(false);
  });
  it('contractors read only their own profile; admins any', () => {
    expect(canReadContractor(contractor, { user_id: 'u-con' })).toBe(true);
    expect(canReadContractor(otherContractor, { user_id: 'u-con' })).toBe(false);
    expect(canReadContractor(ops, { user_id: 'u-con' })).toBe(true);
  });
});

describe('leads (invariant 4)', () => {
  it('only admins may read leads', () => {
    expect(canReadLeads(owner)).toBe(true);
    expect(canReadLeads(ops)).toBe(true);
    expect(canReadLeads(contractor)).toBe(false);
    expect(canReadLeads(client)).toBe(false);
  });
});

describe('timesheets', () => {
  it('a contractor may submit only their own timesheet', () => {
    expect(canSubmitTimesheet(contractor, 'c-1')).toBe(true);
    expect(canSubmitTimesheet(contractor, 'c-2')).toBe(false);
    expect(canSubmitTimesheet(owner, 'c-2')).toBe(true);
    expect(canSubmitTimesheet(client, 'c-1')).toBe(false);
  });
  it('read scope: contractor own, client own job, admin all', () => {
    expect(canReadTimesheet(contractor, { contractor_id: 'c-1' })).toBe(true);
    expect(canReadTimesheet(contractor, { contractor_id: 'c-2' })).toBe(false);
    expect(canReadTimesheet(client, { contractor_id: 'c-1', job_client_id: 'cl-1' })).toBe(true);
    expect(canReadTimesheet(client, { contractor_id: 'c-1', job_client_id: 'cl-2' })).toBe(false);
    expect(canReadTimesheet(ops, { contractor_id: 'c-9' })).toBe(true);
  });
  it('only admins manage (approve/return) timesheets', () => {
    expect(canManageTimesheets(owner)).toBe(true);
    expect(canManageTimesheets(contractor)).toBe(false);
  });
});

describe('invoices', () => {
  it('only admins manage invoices', () => {
    expect(canManageInvoices(ops)).toBe(true);
    expect(canManageInvoices(contractor)).toBe(false);
    expect(canManageInvoices(client)).toBe(false);
  });
  it('read scope: contractor own, client own, admin all', () => {
    expect(canReadInvoice(contractor, { contractor_id: 'c-1' })).toBe(true);
    expect(canReadInvoice(contractor, { contractor_id: 'c-2' })).toBe(false);
    expect(canReadInvoice(client, { client_id: 'cl-1' })).toBe(true);
    expect(canReadInvoice(client, { client_id: 'cl-2' })).toBe(false);
    expect(canReadInvoice(owner, { contractor_id: 'c-1', client_id: 'cl-1' })).toBe(true);
  });
});

describe('credentials', () => {
  it('only admins verify/reject credentials', () => {
    expect(canManageCredentials(owner)).toBe(true);
    expect(canManageCredentials(contractor)).toBe(false);
  });
  it('a contractor reads/writes only their own credentials', () => {
    expect(canReadCredential(contractor, { contractor_id: 'c-1' })).toBe(true);
    expect(canReadCredential(contractor, { contractor_id: 'c-2' })).toBe(false);
    expect(canWriteCredential(contractor, { contractor_id: 'c-1' })).toBe(true);
    expect(canWriteCredential(otherContractor, { contractor_id: 'c-1' })).toBe(false);
    expect(canReadCredential(ops, { contractor_id: 'c-9' })).toBe(true);
  });
});

describe('redactForRole (invariant 6)', () => {
  const job = {
    id: 'j-1',
    title: 'Roof repair',
    internal_notes: 'client is difficult',
    private_admin_notes: 'margin 40%',
  };

  it('strips internal fields for non-admins', () => {
    const out = redactForRole(contractor, job, INTERNAL_JOB_FIELDS);
    expect(out.internal_notes).toBeUndefined();
    expect(out.private_admin_notes).toBeUndefined();
    expect(out.title).toBe('Roof repair');
  });

  it('leaves the record intact for admins', () => {
    const out = redactForRole(owner, job, INTERNAL_JOB_FIELDS);
    expect(out.internal_notes).toBe('client is difficult');
    expect(out.private_admin_notes).toBe('margin 40%');
  });

  it('does not mutate the original record', () => {
    redactForRole(client, job, INTERNAL_JOB_FIELDS);
    expect(job.internal_notes).toBe('client is difficult');
  });
});
