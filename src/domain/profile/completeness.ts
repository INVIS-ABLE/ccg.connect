/**
 * Profile completeness — a simple, testable score over the core profile fields
 * so we can nudge contractors/clients to finish filling things in.
 */
export interface ProfileLike {
  first_name?: string | null;
  display_name?: string | null;
  phone?: string | null;
  profile_photo_url?: string | null;
  preferred_contact_method?: string | null;
}

export function profileCompleteness(profile: ProfileLike | null): { percent: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ['Name', !!(profile?.first_name || profile?.display_name)],
    ['Phone number', !!profile?.phone],
    ['Profile photo', !!profile?.profile_photo_url],
    ['Preferred contact', !!profile?.preferred_contact_method],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}
