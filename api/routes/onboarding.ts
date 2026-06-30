import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { userProfiles, contactAddresses, contractorProfiles, clients, auditEvents } from '../db/schema';
import { requireAuth } from '../lib/session';
import { geocodePostcode } from '../lib/geocode';
import type { AppEnv } from '../env';

/**
 * Self-service onboarding. Runs after Better Auth sign-up; the caller is
 * authenticated but may not yet have a profile. It creates a complete
 * contractor OR client profile server-side.
 *
 * SECURITY (non-negotiable): public onboarding may only ever create `contractor`
 * or `client` freely. The `staff` path additionally grants `ops_admin` ONLY when
 * the caller presents the correct, server-held staff invite code — it can never
 * grant `owner`, and an existing admin is never downgraded. Direct admin creation
 * (incl. owner) remains the admin-only path in routes/adminPromotion.ts.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

/** Constant-time string comparison to avoid leaking the invite code via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Addr = {
  line_1?: string;
  line_2?: string;
  town_city?: string;
  county?: string;
  postcode?: string;
};

route.post('/', async (c) => {
  const p = c.get('principal');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const role = body.role;
  if (role !== 'contractor' && role !== 'client' && role !== 'staff') {
    return c.json({ error: 'invalid_role' }, 400);
  }

  const db = drizzle(c.env.DB);
  const existing = (
    await db.select().from(userProfiles).where(eq(userProfiles.user_id, p.userId)).limit(1)
  )[0];

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  // ── Staff self-registration (invite-code gated) ──
  // Visible "Cook Construction staff" path. Grants ops_admin ONLY with the
  // correct server-held code; never owner; audited.
  if (role === 'staff') {
    const expected = c.env.STAFF_INVITE_CODE;
    if (!expected) return c.json({ error: 'staff_signup_disabled' }, 403);
    const code = typeof body.staff_code === 'string' ? body.staff_code.trim() : '';
    if (!code || !safeEqual(code, expected)) return c.json({ error: 'invalid_staff_code' }, 403);

    // An existing owner must not be silently demoted to ops_admin; treat as done.
    if (existing?.role === 'owner') {
      return c.json({ profile: existing }, 200);
    }

    const now = new Date().toISOString();
    const staffValues = {
      role: 'ops_admin' as const,
      first_name: str(body.first_name),
      last_name: str(body.last_name),
      display_name:
        str(body.display_name) ??
        ([str(body.first_name), str(body.last_name)].filter(Boolean).join(' ') || null),
      email: str(body.email),
      phone: str(body.phone),
      account_status: 'active' as const,
      onboarding_completed_at: now,
      terms_accepted_at: body.terms_accepted ? now : (existing?.terms_accepted_at ?? null),
      privacy_accepted_at: body.privacy_accepted ? now : (existing?.privacy_accepted_at ?? null),
    };
    if (existing) {
      await db.update(userProfiles).set(staffValues).where(eq(userProfiles.user_id, p.userId));
    } else {
      await db.insert(userProfiles).values({ user_id: p.userId, ...staffValues });
    }

    await db.insert(auditEvents).values({
      actor_user_id: p.userId,
      action: 'staff.self_register',
      entity_type: 'user_profile',
      entity_id: p.userId,
      new_values: JSON.stringify({ role: 'ops_admin', account_status: 'active' }),
      timestamp: now,
      reason: 'Staff self-registration with invite code',
    });

    const updatedStaff = (
      await db.select().from(userProfiles).where(eq(userProfiles.user_id, p.userId)).limit(1)
    )[0];
    return c.json({ profile: updatedStaff }, existing ? 200 : 201);
  }

  // Never let contractor/client onboarding touch an admin account.
  if (existing && (existing.role === 'owner' || existing.role === 'ops_admin')) {
    return c.json({ error: 'already_provisioned' }, 409);
  }

  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const now = new Date().toISOString();
  const address = (body.address ?? {}) as Addr;
  const contractor = (body.contractor ?? {}) as Record<string, unknown>;
  const client = (body.client ?? {}) as Record<string, unknown>;

  const profileFields = {
    role: role as 'contractor' | 'client',
    first_name: str(body.first_name),
    last_name: str(body.last_name),
    display_name: str(body.display_name),
    email: str(body.email),
    phone: str(body.phone),
    preferred_contact_method:
      body.preferred_contact_method === 'phone' ||
      body.preferred_contact_method === 'email' ||
      body.preferred_contact_method === 'sms' ||
      body.preferred_contact_method === 'whatsapp'
        ? (body.preferred_contact_method as 'phone' | 'email' | 'sms' | 'whatsapp')
        : null,
    account_status: 'pending' as const,
    terms_accepted_at: body.terms_accepted ? now : (existing?.terms_accepted_at ?? null),
    privacy_accepted_at: body.privacy_accepted ? now : (existing?.privacy_accepted_at ?? null),
    onboarding_completed_at: now,
  };

  // ── Role-specific record ──
  let clientId: string | null = existing?.client_id ?? null;
  if (role === 'contractor') {
    const cp = (
      await db.select({ id: contractorProfiles.id }).from(contractorProfiles).where(eq(contractorProfiles.user_id, p.userId)).limit(1)
    )[0];
    const cpValues = {
      user_id: p.userId,
      trading_name: str(contractor.trading_name) ?? profileFields.display_name,
      legal_name: str(contractor.legal_name),
      company_number: str(contractor.company_number),
      primary_trade: str(contractor.primary_trade),
      base_postcode: str(contractor.base_postcode) ?? str(address.postcode),
      biography: str(contractor.biography),
      service_radius_miles: num(contractor.service_radius_miles),
      day_rate: num(contractor.day_rate),
      hourly_rate: num(contractor.hourly_rate),
    };
    if (cp) {
      await db.update(contractorProfiles).set(cpValues).where(eq(contractorProfiles.id, cp.id));
    } else {
      await db.insert(contractorProfiles).values({ ...cpValues, approval_status: 'pending' });
    }
  } else {
    const name = str(client.company_name) ?? profileFields.display_name ?? 'Client';
    const clientValues = {
      individual_or_company_name: name,
      client_type:
        client.client_type === 'individual' ||
        client.client_type === 'company' ||
        client.client_type === 'housing_association' ||
        client.client_type === 'local_authority' ||
        client.client_type === 'other'
          ? (client.client_type as 'individual' | 'company' | 'housing_association' | 'local_authority' | 'other')
          : 'company',
      main_contact_name: profileFields.display_name,
      email: profileFields.email,
      phone: profileFields.phone,
      default_postcode: str(address.postcode),
      default_site_address: str(address.line_1),
    };
    if (clientId) {
      await db.update(clients).set(clientValues).where(eq(clients.id, clientId));
    } else {
      const created = await db.insert(clients).values(clientValues).returning();
      clientId = created[0]?.id ?? null;
    }
  }

  // ── User profile (with client linkage for client users) ──
  const upValues = { ...profileFields, client_id: role === 'client' ? clientId : null };
  if (existing) {
    await db.update(userProfiles).set(upValues).where(eq(userProfiles.user_id, p.userId));
  } else {
    await db.insert(userProfiles).values({ user_id: p.userId, ...upValues });
  }

  // ── Primary contact address (geocoded) ──
  if (address.postcode || address.line_1) {
    const geo = await geocodePostcode(address.postcode);
    await db.insert(contactAddresses).values({
      user_id: p.userId,
      address_type: 'contact',
      line_1: str(address.line_1),
      line_2: str(address.line_2),
      town_city: str(address.town_city),
      county: str(address.county),
      postcode: str(address.postcode),
      latitude: geo?.lat ?? null,
      longitude: geo?.lng ?? null,
      is_primary: true,
      privacy_level: 'private',
    });
  }

  const updated = (
    await db.select().from(userProfiles).where(eq(userProfiles.user_id, p.userId)).limit(1)
  )[0];
  return c.json({ profile: updated }, existing ? 200 : 201);
});

export default route;
