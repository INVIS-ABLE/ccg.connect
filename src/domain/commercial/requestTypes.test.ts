import { describe, it, expect } from 'vitest';
import {
  REQUEST_TYPES,
  isRequestType,
  requestTypeInfo,
  listRequestTypes,
  defaultUrgencyFor,
} from './requestTypes';

describe('requestTypes', () => {
  it('lists every type with complete info', () => {
    const list = listRequestTypes();
    expect(list).toHaveLength(REQUEST_TYPES.length);
    for (const info of list) {
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.summary.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'emergency']).toContain(info.defaultUrgency);
      expect(typeof info.needsHeadcount).toBe('boolean');
    }
  });

  it('validates request-type strings', () => {
    expect(isRequestType('gang_request')).toBe(true);
    expect(isRequestType('nonsense')).toBe(false);
    expect(isRequestType(null)).toBe(false);
    expect(isRequestType(123)).toBe(false);
  });

  it('marks emergency replacements as emergency urgency', () => {
    expect(requestTypeInfo('emergency_replacement').defaultUrgency).toBe('emergency');
    expect(defaultUrgencyFor('emergency_replacement')).toBe('emergency');
  });

  it('treats enquiries as low urgency and needing no headcount', () => {
    const enquiry = requestTypeInfo('client_enquiry');
    expect(enquiry.defaultUrgency).toBe('low');
    expect(enquiry.needsHeadcount).toBe(false);
  });

  it('flags headcount only for labour/gang/emergency types', () => {
    expect(requestTypeInfo('labour_request').needsHeadcount).toBe(true);
    expect(requestTypeInfo('gang_request').needsHeadcount).toBe(true);
    expect(requestTypeInfo('subcontract_package').needsHeadcount).toBe(false);
    expect(requestTypeInfo('site_visit').needsHeadcount).toBe(false);
  });

  it('defaults urgency to medium for unknown/unset types', () => {
    expect(defaultUrgencyFor(undefined)).toBe('medium');
    expect(defaultUrgencyFor('whatever')).toBe('medium');
    expect(defaultUrgencyFor('labour_request')).toBe('medium');
  });
});
