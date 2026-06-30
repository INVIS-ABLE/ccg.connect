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
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  account_status: 'active' | 'pending' | 'suspended' | 'archived';
  preferred_contact_method?: 'phone' | 'email' | 'sms' | 'whatsapp' | null;
  onboarding_completed_at?: string | null;
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

export interface Contractor {
  id: string;
  user_id: string;
  trading_name: string | null;
  legal_name: string | null;
  primary_trade: string | null;
  base_postcode: string | null;
  approval_status: 'pending' | 'approved' | 'suspended' | 'rejected' | 'archived';
  preferred_contractor: boolean;
  day_rate: number | null;
  hourly_rate: number | null;
}

export interface Client {
  id: string;
  client_reference: string | null;
  client_type: 'individual' | 'company' | 'housing_association' | 'local_authority' | 'other';
  individual_or_company_name: string;
  main_contact_name: string | null;
  email: string | null;
  phone: string | null;
  billing_email: string | null;
  billing_address: string | null;
  default_site_address: string | null;
  default_postcode: string | null;
  account_status: 'active' | 'inactive' | 'suspended';
  portal_enabled: boolean;
}

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  site_postcode: string | null;
  work_type: string | null;
  description: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'rejected';
  created_at: string;
}

export interface Timesheet {
  id: string;
  job_id: string;
  contractor_id: string;
  week_start: string;
  status: string;
  total_hours: number | null;
  total_amount: number | null;
}

export interface Invoice {
  id: string;
  job_id: string;
  contractor_id: string | null;
  client_id: string | null;
  invoice_number: string | null;
  invoice_type: 'contractor_to_ccg' | 'ccg_to_client';
  net_amount: number | null;
  vat_amount: number | null;
  gross_amount: number | null;
  status: string;
}

export interface Quote {
  id: string;
  job_id: string | null;
  client_id: string | null;
  quote_number: string | null;
  recipient_name: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  line_items: string | null;
  net_amount: number | null;
  vat_rate: number;
  vat_amount: number | null;
  gross_amount: number | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
}

export interface CredentialType {
  id: string;
  name: string;
  category: string | null;
  requires_expiry: boolean;
}

export interface ContractorCredential {
  id: string;
  contractor_id: string;
  credential_type_id: string;
  issuer: string | null;
  registration_or_policy_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  file_url: string | null;
  verification_status: 'awaiting_review' | 'verified' | 'rejected' | 'expired' | 'superseded';
  rejection_reason: string | null;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  notification_type: string | null;
  deep_link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface JobMediaItem {
  id: string;
  job_id: string;
  media_type: 'image' | 'video' | 'document';
  category: string;
  original_filename: string | null;
  caption: string | null;
  client_visible: boolean;
  url: string;
  created_at: string;
}

// ── Direct messaging ─────────────────────────────────────────────────────────
export interface MessagingContact {
  user_id: string;
  name: string;
  role: AppRole | null;
  profile_photo_url: string | null;
}

export interface ConversationSummary {
  id: string;
  other: MessagingContact;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread: number;
}

export interface DirectMessage {
  id: string;
  sender_user_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  mine: boolean;
  attachment_url?: string | null;
  attachment_type?: 'image' | 'audio' | 'file' | null;
  attachment_name?: string | null;
}

export interface MatchCandidate {
  contractor_id: string;
  trading_name: string | null;
  latitude: number | null;
  longitude: number | null;
  eligible: boolean;
  totalScore: number;
  breakdown: { skill: number; distance: number; availability: number; credential: number; preference: number };
  distanceMiles: number | null;
  reasons: string[];
}
