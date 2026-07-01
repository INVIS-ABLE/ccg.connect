import { describe, it, expect } from 'vitest';
import {
  riskRating,
  blankContent,
  parseContent,
  validateCompleteness,
  highestResidualBand,
  requiresHazards,
  sectionDefs,
  type Hazard,
  type RamsContent,
} from './rams';

const hazard = (over: Partial<Hazard> = {}): Hazard => ({
  hazard: 'Working at height',
  who_at_risk: 'Operatives',
  likelihood: 3,
  severity: 4,
  controls: 'Scaffold with edge protection; harness',
  residual_likelihood: 1,
  residual_severity: 4,
  ...over,
});

describe('riskRating (5×5 matrix banding)', () => {
  it('bands by likelihood × severity', () => {
    expect(riskRating(1, 1)).toEqual({ score: 1, band: 'low' });
    expect(riskRating(2, 2)).toEqual({ score: 4, band: 'low' }); // boundary low
    expect(riskRating(1, 5)).toEqual({ score: 5, band: 'medium' }); // boundary medium
    expect(riskRating(3, 4)).toEqual({ score: 12, band: 'medium' }); // boundary medium
    expect(riskRating(3, 5)).toEqual({ score: 15, band: 'high' }); // boundary high
    expect(riskRating(5, 5)).toEqual({ score: 25, band: 'high' });
  });
  it('clamps out-of-range and non-numeric inputs', () => {
    expect(riskRating(9, 9).score).toBe(25); // clamped to 5×5
    expect(riskRating('foo', 3).score).toBe(0);
    expect(riskRating(-2, 4).score).toBe(0);
  });
});

describe('parseContent', () => {
  it('parses a JSON string and preserves the sections present', () => {
    const c = parseContent(JSON.stringify({ sections: { scope: 'Dig trench' }, hazards: [hazard()] }));
    expect(c.sections.scope).toBe('Dig trench');
    expect(c.sections.ppe).toBeUndefined(); // absent sections aren't scaffolded here
    expect(c.hazards).toHaveLength(1);
    expect(c.hazards[0]?.likelihood).toBe(3);
  });
  it('preserves sections for any form type (type-agnostic)', () => {
    const c = parseContent({ sections: { topic: 'Working at height', attendees: 'Gang A' }, hazards: [] });
    expect(c.sections.topic).toBe('Working at height');
    expect(c.sections.attendees).toBe('Gang A');
  });
  it('is defensive against garbage', () => {
    const empty = { sections: {}, hazards: [] };
    expect(parseContent('not json')).toEqual(empty);
    expect(parseContent(null)).toEqual(empty);
    expect(parseContent({ hazards: 'nope' }).hazards).toEqual([]);
  });
  it('clamps hazard numbers on the way in', () => {
    const c = parseContent({ sections: {}, hazards: [{ hazard: 'x', controls: 'y', likelihood: 99, severity: -3 }] });
    expect(c.hazards[0]?.likelihood).toBe(5);
    expect(c.hazards[0]?.severity).toBe(0);
  });
});

describe('site template types', () => {
  it('gives each form type its own section scaffold', () => {
    expect(sectionDefs('toolbox_talk').map((s) => s.key)).toContain('topic');
    expect(sectionDefs('daily_diary').map((s) => s.key)).toContain('works_completed');
    expect(sectionDefs('snagging').map((s) => s.key)).toContain('snag_description');
    // Unknown/default falls back to the method-statement sections.
    expect(sectionDefs().map((s) => s.key)).toContain('scope');
  });

  it('blankContent scaffolds the type\'s keys, empty', () => {
    const c = blankContent('toolbox_talk');
    expect(c.hazards).toEqual([]);
    expect(c.sections.topic).toBe('');
    expect(c.sections.attendees).toBe('');
    expect(c.sections.scope).toBeUndefined(); // not a toolbox-talk section
  });

  it('only RAMS carries the hazard table', () => {
    expect(requiresHazards('rams')).toBe(true);
    expect(requiresHazards('toolbox_talk')).toBe(false);
    expect(requiresHazards('site_induction')).toBe(false);
  });

  it('validates completeness against the type\'s required sections', () => {
    const partial: RamsContent = { sections: { topic: 'Ladders' }, hazards: [] };
    const r = validateCompleteness(partial, 'toolbox_talk');
    expect(r.complete).toBe(false);
    expect(r.missing).toContain('Attendees');
    expect(r.missing).toContain('Key points covered');

    const full: RamsContent = { sections: { topic: 'Ladders', attendees: 'Gang A', key_points: 'Inspect before use' }, hazards: [] };
    expect(validateCompleteness(full, 'toolbox_talk')).toEqual({ complete: true, missing: [] });
  });
});

describe('validateCompleteness', () => {
  const full: RamsContent = {
    sections: { scope: 'a', sequence: 'b', ppe: 'c', emergency: 'd' },
    hazards: [hazard()],
  };

  it('passes a complete RAMS (required sections + a usable hazard)', () => {
    expect(validateCompleteness(full, 'rams')).toEqual({ complete: true, missing: [] });
  });

  it('flags missing required sections', () => {
    const c: RamsContent = { sections: { scope: 'a' }, hazards: [hazard()] };
    const r = validateCompleteness(c, 'rams');
    expect(r.complete).toBe(false);
    expect(r.missing).toContain('Sequence of operations');
    expect(r.missing).toContain('PPE required');
    expect(r.missing).toContain('Emergency procedures');
  });

  it('RAMS requires at least one hazard with controls; method statement does not', () => {
    const noHazards: RamsContent = { sections: full.sections, hazards: [] };
    expect(validateCompleteness(noHazards, 'rams').missing).toContain('At least one hazard with control measures');
    expect(validateCompleteness(noHazards, 'method_statement').complete).toBe(true);
  });

  it('a hazard without controls does not satisfy the RAMS hazard requirement', () => {
    const c: RamsContent = { sections: full.sections, hazards: [hazard({ controls: '' })] };
    expect(validateCompleteness(c, 'rams').complete).toBe(false);
  });
});

describe('highestResidualBand', () => {
  it('returns the worst residual band across hazards', () => {
    const c: RamsContent = {
      sections: {},
      hazards: [hazard({ residual_likelihood: 1, residual_severity: 1 }), hazard({ residual_likelihood: 4, residual_severity: 4 })],
    };
    expect(highestResidualBand(c)).toBe('high');
  });
  it('is null when there are no hazards', () => {
    expect(highestResidualBand(blankContent())).toBeNull();
  });
});

describe('requiresHazards', () => {
  it('only RAMS needs a hazard table', () => {
    expect(requiresHazards('rams')).toBe(true);
    expect(requiresHazards('method_statement')).toBe(false);
  });
});
