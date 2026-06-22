import { describe, it, expect, vi } from 'vitest';
import {
  buildAuditRecord,
  redactValues,
  createAuditRecorder,
  AUDIT_ACTIONS,
  type AuditEventRecord,
} from './auditService';

const fixedNow = () => new Date('2026-06-22T10:00:00.000Z');
const fixedId = () => 'corr-123';

describe('redactValues', () => {
  it('redacts secret-like keys at any depth', () => {
    const out = redactValues({
      email: 'a@b.com',
      password: 'hunter2',
      nested: { access_token: 'abc', file_url: 'https://x/y', keep: 1 },
      list: [{ apiKey: 'k' }, { ok: true }],
    });
    expect(out).toEqual({
      email: 'a@b.com',
      password: '[REDACTED]',
      nested: { access_token: '[REDACTED]', file_url: '[REDACTED]', keep: 1 },
      list: [{ apiKey: '[REDACTED]' }, { ok: true }],
    });
  });

  it('leaves primitives untouched', () => {
    expect(redactValues('x')).toBe('x');
    expect(redactValues(5)).toBe(5);
    expect(redactValues(null)).toBeNull();
  });
});

describe('buildAuditRecord', () => {
  it('maps input to stable entity field names and stamps time + correlation id', () => {
    const rec = buildAuditRecord(
      {
        actorUserId: 'u1',
        action: AUDIT_ACTIONS.ROLE_CHANGED,
        entityType: 'UserProfile',
        entityId: 'p1',
        previousValues: { role: 'contractor' },
        newValues: { role: 'ops_admin' },
        reason: 'promoted by owner',
      },
      { now: fixedNow, generateCorrelationId: fixedId },
    );

    expect(rec).toEqual<AuditEventRecord>({
      actor_user_id: 'u1',
      action: 'user.role_changed',
      entity_type: 'UserProfile',
      entity_id: 'p1',
      previous_values: JSON.stringify({ role: 'contractor' }),
      new_values: JSON.stringify({ role: 'ops_admin' }),
      timestamp: '2026-06-22T10:00:00.000Z',
      reason: 'promoted by owner',
      correlation_id: 'corr-123',
    });
  });

  it('redacts secrets inside serialised value payloads', () => {
    const rec = buildAuditRecord(
      {
        action: AUDIT_ACTIONS.CREDENTIAL_SHARED,
        entityType: 'ContractorCredential',
        newValues: { file_url: 'https://secret/doc.pdf', issuer: 'Gas Safe' },
      },
      { now: fixedNow, generateCorrelationId: fixedId },
    );
    const parsed = JSON.parse(rec.new_values as string);
    expect(parsed.file_url).toBe('[REDACTED]');
    expect(parsed.issuer).toBe('Gas Safe');
  });

  it('honours a supplied correlation id', () => {
    const rec = buildAuditRecord(
      { action: 'x', entityType: 'Y', correlationId: 'supplied' },
      { now: fixedNow },
    );
    expect(rec.correlation_id).toBe('supplied');
  });

  it('omits optional fields when not provided', () => {
    const rec = buildAuditRecord({ action: 'x', entityType: 'Y' }, { now: fixedNow, generateCorrelationId: fixedId });
    expect(rec.actor_user_id).toBeUndefined();
    expect(rec.entity_id).toBeUndefined();
    expect(rec.previous_values).toBeUndefined();
    expect(rec.new_values).toBeUndefined();
    expect(rec.reason).toBeUndefined();
  });

  it('requires action and entityType', () => {
    expect(() => buildAuditRecord({ action: '', entityType: 'Y' })).toThrow();
    expect(() => buildAuditRecord({ action: 'x', entityType: '' })).toThrow();
  });
});

describe('createAuditRecorder', () => {
  it('persists via the sink and returns the record', async () => {
    const sink = vi.fn().mockResolvedValue({ id: 'a1' });
    const recorder = createAuditRecorder(sink);
    const rec = await recorder.record(
      { action: AUDIT_ACTIONS.JOB_ASSIGNED, entityType: 'JobAssignment', entityId: 'j1' },
      { now: fixedNow, generateCorrelationId: fixedId },
    );
    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith(rec);
    expect(rec.action).toBe('job.assigned');
  });

  it('never throws when the sink fails, but surfaces the error to the console', async () => {
    const err = new Error('rls denied');
    const sink = vi.fn().mockRejectedValue(err);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const recorder = createAuditRecorder(sink);
    await expect(
      recorder.record({ action: 'x', entityType: 'Y' }, { now: fixedNow, generateCorrelationId: fixedId }),
    ).resolves.toBeDefined();
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
