import { describe, it, expect } from 'vitest';
import { profileCompleteness } from './completeness';

describe('profileCompleteness', () => {
  it('is 0% for an empty profile and lists all fields', () => {
    const r = profileCompleteness(null);
    expect(r.percent).toBe(0);
    expect(r.missing).toHaveLength(4);
  });

  it('is 100% when the core fields are present', () => {
    const r = profileCompleteness({
      first_name: 'Lee',
      phone: '+447700900000',
      profile_photo_url: '/api/profiles/u1/photo',
      preferred_contact_method: 'phone',
    });
    expect(r.percent).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it('reports partial completion with the missing items', () => {
    const r = profileCompleteness({ display_name: 'Lee', phone: '+447700900000' });
    expect(r.percent).toBe(50);
    expect(r.missing).toContain('Profile photo');
    expect(r.missing).toContain('Preferred contact');
  });
});
