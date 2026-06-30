import { describe, it, expect } from 'vitest';
import { leadToJobDraft, leadToClientDraft } from './convert';

describe('leadToJobDraft', () => {
  it('uses work_type as the title and trade when present', () => {
    const d = leadToJobDraft({ work_type: 'Kitchen rewire', description: 'Full rewire', site_postcode: 'M1 1AA' });
    expect(d.title).toBe('Kitchen rewire');
    expect(d.trade_category).toBe('Kitchen rewire');
    expect(d.short_description).toBe('Full rewire');
    expect(d.site_postcode).toBe('M1 1AA');
    expect(d.urgency).toBe('medium');
  });

  it('falls back to the company/name when work_type is missing', () => {
    expect(leadToJobDraft({ company: 'Acme Ltd' }).title).toBe('Enquiry: Acme Ltd');
    expect(leadToJobDraft({ name: 'Jane' }).title).toBe('Enquiry: Jane');
    expect(leadToJobDraft({}).title).toBe('New job from lead');
  });

  it('blanks whitespace-only fields to null', () => {
    const d = leadToJobDraft({ work_type: 'Plumbing', description: '   ', site_postcode: '' });
    expect(d.short_description).toBeNull();
    expect(d.site_postcode).toBeNull();
  });
});

describe('leadToClientDraft', () => {
  it('maps a company lead to a company client', () => {
    const d = leadToClientDraft({ company: 'Acme Ltd', name: 'Jane', email: 'j@acme.co', phone: '0161', site_postcode: 'M1 1AA' });
    expect(d.individual_or_company_name).toBe('Acme Ltd');
    expect(d.client_type).toBe('company');
    expect(d.main_contact_name).toBe('Jane');
    expect(d.email).toBe('j@acme.co');
    expect(d.default_postcode).toBe('M1 1AA');
  });

  it('maps a person-only lead to an individual client', () => {
    const d = leadToClientDraft({ name: 'Jane Doe' });
    expect(d.individual_or_company_name).toBe('Jane Doe');
    expect(d.client_type).toBe('individual');
  });

  it('defaults the name when nothing usable is present', () => {
    expect(leadToClientDraft({}).individual_or_company_name).toBe('New client');
  });
});
