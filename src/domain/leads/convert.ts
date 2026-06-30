/**
 * Lead → job / client conversion drafts.
 *
 * Pure mapping from an inbound lead to the pre-filled job and (optional) client
 * records, so the conversion wizard doesn't re-key data and the mapping is
 * testable. The wizard lets an admin edit these before creating anything.
 */
export interface LeadLike {
  name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  site_postcode?: string | null;
  work_type?: string | null;
  description?: string | null;
}

export interface JobDraft {
  title: string;
  short_description: string | null;
  site_postcode: string | null;
  trade_category: string | null;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
}

export interface ClientDraft {
  individual_or_company_name: string;
  client_type: 'individual' | 'company';
  main_contact_name: string | null;
  email: string | null;
  phone: string | null;
  default_postcode: string | null;
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

export function leadToJobDraft(lead: LeadLike): JobDraft {
  const work = clean(lead.work_type);
  const who = clean(lead.company) ?? clean(lead.name);
  return {
    title: work ?? (who ? `Enquiry: ${who}` : 'New job from lead'),
    short_description: clean(lead.description),
    site_postcode: clean(lead.site_postcode),
    trade_category: work,
    urgency: 'medium',
  };
}

export function leadToClientDraft(lead: LeadLike): ClientDraft {
  const company = clean(lead.company);
  const name = clean(lead.name);
  return {
    individual_or_company_name: company ?? name ?? 'New client',
    client_type: company ? 'company' : 'individual',
    main_contact_name: name,
    email: clean(lead.email),
    phone: clean(lead.phone),
    default_postcode: clean(lead.site_postcode),
  };
}
