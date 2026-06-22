import { describe, it, expect } from 'vitest';
import {
  type Principal,
  canManageJobs,
  canReadJob,
  canReadAssignment,
  canReadProfile,
  canWriteProfile,
  canSetRole,
  redactForRole,
  INTERNAL_JOB_FIELDS,
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
