import { describe, it, expect } from 'vitest';
import {
  isIncidentType,
  isIncidentSeverity,
  requiresUrgentEscalation,
  incidentTypeLabel,
} from './incidents';

describe('incident validation', () => {
  it('validates types and severities', () => {
    expect(isIncidentType('accident')).toBe(true);
    expect(isIncidentType('nope')).toBe(false);
    expect(isIncidentSeverity('critical')).toBe(true);
    expect(isIncidentSeverity('huge')).toBe(false);
  });
});

describe('requiresUrgentEscalation', () => {
  it('always escalates accidents', () => {
    expect(requiresUrgentEscalation('accident', 'low')).toBe(true);
  });
  it('always escalates anything critical', () => {
    expect(requiresUrgentEscalation('welfare', 'critical')).toBe(true);
    expect(requiresUrgentEscalation('equipment', 'critical')).toBe(true);
  });
  it('escalates high-severity safety types', () => {
    expect(requiresUrgentEscalation('safety_concern', 'high')).toBe(true);
    expect(requiresUrgentEscalation('harassment', 'high')).toBe(true);
  });
  it('does not escalate low/medium non-accident reports', () => {
    expect(requiresUrgentEscalation('equipment', 'high')).toBe(false);
    expect(requiresUrgentEscalation('client_complaint', 'medium')).toBe(false);
    expect(requiresUrgentEscalation('fatigue', 'low')).toBe(false);
  });
});

describe('incidentTypeLabel', () => {
  it('humanises types', () => {
    expect(incidentTypeLabel('near_miss')).toBe('Near miss');
    expect(incidentTypeLabel('worker_complaint')).toBe('Worker complaint');
  });
});
