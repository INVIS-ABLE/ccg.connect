/**
 * Frontend-facing shapes returned by the CCG Connect API (api/routes/*). Kept
 * deliberately light and decoupled from the Drizzle/server types — the API is the
 * contract. Extend as endpoints grow.
 */
import type { AppRole } from '@/domain/auth/roles';

export type { Principal } from '@/domain/permissions/permissions';

export interface UserProfile {
  id: string;
  user_id: string;
  role: AppRole;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  account_status: 'active' | 'pending' | 'suspended' | 'archived';
}

export interface Job {
  id: string;
  job_reference: string | null;
  client_id: string | null;
  title: string;
  short_description: string | null;
  site_postcode: string | null;
  trade_category: string | null;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  start_date: string | null;
  end_date: string | null;
  status: string;
  // internal_notes / private_admin_notes are redacted for non-admins (server-side).
  internal_notes?: string | null;
  client_visible_notes: string | null;
  created_at: string;
}

export interface JobAssignment {
  id: string;
  job_id: string;
  contractor_id: string;
  assignment_status: 'active' | 'completed' | 'cancelled' | 'suspended';
  agreed_rate_type: 'hourly' | 'daily' | 'fixed';
  agreed_rate: number | null;
  planned_start: string | null;
  planned_finish: string | null;
}
