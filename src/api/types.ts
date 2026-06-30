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
  sector?: 'domestic' | 'commercial' | null;
  /** JSON array of { description, qty, unit_cost } — internal cost breakdown. */
  materials?: string | null;
  labour_cost?: number | null;
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
  kind: 'direct' | 'job';
  /** The other person for a direct chat; null for a job room. */
  other: MessagingContact | null;
  /** Display title for a job room; null for a direct chat. */
  title: string | null;
  job_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread: number;
  pinned: boolean;
  muted: boolean;
}

export interface JobChatCandidate {
  job_id: string;
  title: string;
  job_reference: string | null;
  /** The existing job room id, or null if it hasn't been opened yet. */
  conversation_id: string | null;
}

export interface ReplyPreview {
  id: string;
  sender_user_id: string;
  body: string;
  attachment_type: 'image' | 'audio' | 'file' | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
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
  reply_to?: ReplyPreview | null;
  reactions?: ReactionSummary[];
  /** Sender contact, present only for job-room messages (multi-party). */
  sender?: MessagingContact | null;
}

export interface JobCheckin {
  id: string;
  job_id: string;
  user_id: string;
  user_name: string;
  check_type: 'arrival' | 'departure';
  checked_in_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  note: string | null;
}

// ── Commercial / agency ──────────────────────────────────────────────────────
export interface CorporateAccount {
  id: string;
  legal_name: string;
  trading_name: string | null;
  registration_number: string | null;
  status: 'prospect' | 'active' | 'inactive';
  vat_treatment: string | null;
  cis_treatment: string | null;
  payment_terms: string | null;
  framework_agreement: string | null;
  insurance_requirements: string | null;
  required_accreditations: string | null;
  invoice_instructions: string | null;
  supplier_portal_reference: string | null;
  data_retention_note: string | null;
  notes: string | null;
}

export interface CorporateContact {
  id: string;
  account_id: string;
  name: string;
  role: 'commercial' | 'procurement' | 'accounts' | 'site' | 'other';
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export interface CommercialProject {
  id: string;
  account_id: string;
  name: string;
  project_number: string | null;
  region_division: string | null;
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';
  notes: string | null;
}

export interface CommercialSite {
  id: string;
  project_id: string;
  account_id: string;
  name: string;
  site_address: string | null;
  postcode: string | null;
  what3words: string | null;
  latitude: number | null;
  longitude: number | null;
  principal_contractor: string | null;
  site_manager: string | null;
  commercial_manager: string | null;
  working_hours: string | null;
  parking_access: string | null;
  induction_instructions: string | null;
  ppe_requirements: string | null;
  drug_alcohol_policy: string | null;
  emergency_arrangements: string | null;
  welfare_info: string | null;
  site_rules: string | null;
  required_cards: string | null;
  prohibited_activities: string | null;
  check_in_method: 'qr' | 'geofence' | 'roll_call' | 'supervisor' | 'manual' | null;
  geofence_radius_m: number | null;
  po_number: string | null;
  cost_code: string | null;
  status: 'active' | 'completed' | 'suspended';
}

// ── Workforce ────────────────────────────────────────────────────────────────
export interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
  mobile: string | null;
  email: string | null;
  home_address: string | null;
  base_postcode: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  right_to_work_status: 'unchecked' | 'checked' | 'expired' | 'restricted';
  rtw_check_date: string | null;
  rtw_checked_by: string | null;
  rtw_expiry: string | null;
  payment_model: 'paye' | 'cis' | 'umbrella' | 'limited' | null;
  primary_trade: string | null;
  additional_skills: string | null;
  experience_years: number | null;
  driving_licence: string | null;
  plant_tickets: string | null;
  preferred_travel_miles: number | null;
  day_rate: number | null;
  hourly_rate: number | null;
  contractor_id: string | null;
  user_id: string | null;
  status: 'active' | 'inactive' | 'archived';
  notes: string | null;
}

export interface WorkerCard {
  id: string;
  worker_id: string;
  card_type: string;
  reference: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  verification_status: 'unverified' | 'verified' | 'rejected' | 'expired';
  file_url: string | null;
  notes: string | null;
}

export interface Gang {
  id: string;
  name: string;
  gang_leader_worker_id: string | null;
  base_postcode: string | null;
  service_radius_miles: number | null;
  usual_day_rate: number | null;
  vehicles: string | null;
  plant_capability: string | null;
  notes: string | null;
  status: 'active' | 'inactive';
}

export interface GangMember {
  id: string;
  worker_id: string;
  role: 'leader' | 'permanent' | 'reserve';
  /** The worker passport with cards, for the compliance matrix. */
  worker: (Worker & { cards: WorkerCard[] }) | null;
}

export interface LabourRequest {
  id: string;
  account_id: string;
  project_id: string | null;
  site_id: string | null;
  title: string;
  work_package: string | null;
  trade: string | null;
  number_required: number;
  gang_composition: string | null;
  start_date: string | null;
  finish_date: string | null;
  shift_pattern: string | null;
  minimum_qualifications: string | null;
  experience_required: string | null;
  employment_model: 'labour_supply' | 'managed_workforce' | 'subcontract_work_package' | null;
  rate_offered: number | null;
  charge_rate: number | null;
  overtime_rate: number | null;
  travel_lodge_allowance: string | null;
  po_number: string | null;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  replacement_sla: string | null;
  status:
    | 'draft' | 'awaiting_approval' | 'open' | 'sourcing' | 'partially_filled'
    | 'fully_filled' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
}

export interface Deployment {
  id: string;
  labour_request_id: string;
  account_id: string | null;
  site_id: string | null;
  gang_id: string | null;
  status: 'proposed' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  start_date: string | null;
  finish_date: string | null;
  compliance_snapshot: string | null;
  confirmed_at: string | null;
  conversation_id: string | null;
  notes: string | null;
}

export interface DeploymentMember {
  id: string;
  worker_id: string;
  role: string | null;
  pay_rate: number | null;
  charge_rate: number | null;
  worker: (Worker & { cards: WorkerCard[] }) | null;
}

export interface ComplianceCell {
  workerId: string;
  name: string;
  cells: Record<string, 'ok' | 'warning' | 'missing'>;
  deployable: boolean;
}

export interface PayTotals {
  totalHours: number;
  payBasic: number;
  payOvertime: number;
  workerPay: number;
  employerCost: number;
  clientCharge: number;
  margin: number;
}

export interface CommercialTimesheet {
  id: string;
  deployment_id: string;
  worker_id: string;
  week_start: string;
  basic_hours: number;
  overtime_hours: number;
  pay_rate: number | null;
  charge_rate: number | null;
  oncost_rate: number | null;
  overtime_multiplier: number | null;
  travel: number | null;
  lodge: number | null;
  expenses: number | null;
  deductions: number | null;
  status: 'draft' | 'submitted' | 'site_confirmed' | 'ops_approved' | 'locked' | 'invoiced' | 'rejected';
  rejection_reason: string | null;
  notes: string | null;
  totals: PayTotals;
}

export interface CommercialInvoice {
  id: string;
  account_id: string | null;
  deployment_id: string | null;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  line_items: string | null;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  notes: string | null;
}

export interface AttendanceRecord {
  id: string;
  deployment_id: string;
  worker_id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'no_show';
  check_in_time: string | null;
  check_out_time: string | null;
  method: 'qr' | 'geofence' | 'roll_call' | 'supervisor' | 'manual' | null;
  geofence_ok: boolean | null;
  geofence_distance_m: number | null;
  reason: string | null;
  replacement_needed: boolean;
  notes: string | null;
}

/** A worker's today status as seen on the QR check-in screen. */
export interface CheckinStatus {
  worker_id: string;
  full_name: string;
  status: 'present' | 'late' | 'absent' | 'no_show' | null;
  check_in_time: string | null;
  check_out_time: string | null;
  geofence_ok: boolean | null;
  geofence_distance_m: number | null;
}

/** Context for the QR site check-in screen (worker self-service or admin kiosk). */
export interface CheckinContext {
  deployment: {
    id: string;
    status: string;
    start_date: string | null;
    site_name: string | null;
    site_postcode: string | null;
  };
  date: string;
  is_admin: boolean;
  /** Present for admins/ops: the full roster with today's marks. */
  roster?: CheckinStatus[];
  /** Present for a worker checking themselves in. */
  me_worker?: CheckinStatus;
}

export interface KidDocument {
  id: string;
  deployment_id: string;
  worker_id: string;
  version: number;
  status: 'draft' | 'issued' | 'acknowledged' | 'superseded';
  employment_business: string | null;
  contract_type: string | null;
  payment_model: string | null;
  pay_rate: number | null;
  pay_frequency: string | null;
  paid_by: string | null;
  deductions: string | null;
  holiday_entitlement: string | null;
  holiday_pay: string | null;
  other_fees: string | null;
  example_calculation: string | null;
  notes: string | null;
  issued_at: string | null;
  acknowledged_at: string | null;
  acknowledged_signature: string | null;
}

export interface Incident {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'closed';
  account_id: string | null;
  site_id: string | null;
  deployment_id: string | null;
  worker_id: string | null;
  gang_id: string | null;
  occurred_at: string | null;
  description: string | null;
  immediate_action: string | null;
  witnesses: string | null;
  investigation: string | null;
  outcome: string | null;
  restricted_notes: string | null;
  urgent: boolean;
}

export interface SiteDiaryEntry {
  id: string;
  deployment_id: string;
  date: string;
  weather: string | null;
  headcount: number | null;
  work_summary: string | null;
  deliveries: string | null;
  visitors: string | null;
  issues: string | null;
  notes: string | null;
}

export interface ReplacementCandidate {
  workerId: string;
  name: string;
  compliance: ComplianceCell;
  score: number;
}

export interface DeploymentReplacement {
  id: string;
  deployment_id: string;
  original_worker_id: string;
  replacement_worker_id: string | null;
  reason: string | null;
  status: 'requested' | 'filled' | 'cancelled';
  requested_by: string | null;
  filled_at: string | null;
  created_at: string;
}

export interface MonthBucket {
  month: string;
  label: string;
  value: number;
}

export interface CommercialDashboard {
  months: number;
  kpis: {
    activeDeployments: number;
    workersDeployed: number;
    openRequests: number;
    revenue: number;
    outstanding: number;
    margin: number;
    marginPct: number;
    attendanceRate: number;
    openIncidents: number;
  };
  margin: { workerPay: number; employerCost: number; clientCharge: number; margin: number; marginPct: number };
  attendance: { total: number; present: number; absent: number; rate: number };
  revenueTrend: MonthBucket[];
  marginTrend: MonthBucket[];
  revenueByAccount: { key: string; value: number; label: string }[];
  deploymentsByStatus: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
}

export interface CorporateAccountUser {
  id: string;
  account_id: string;
  user_id: string;
  granted_by: string | null;
  created_at: string;
}

export interface PortalDeployment {
  id: string;
  status: string;
  start_date: string | null;
  finish_date: string | null;
  site_name: string | null;
  request_title: string | null;
  workers_required: number | null;
  workers_assigned: number;
}

export interface PortalInvoice {
  id: string;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  status: string;
}

export interface PortalCommercial {
  accounts: { id: string; name: string }[];
  deployments: PortalDeployment[];
  invoices: PortalInvoice[];
}

export type FormType = 'rams' | 'method_statement';

export interface RamsHazard {
  hazard: string;
  who_at_risk: string;
  likelihood: number;
  severity: number;
  controls: string;
  residual_likelihood: number;
  residual_severity: number;
}

export interface RamsContent {
  sections: Record<string, string>;
  hazards: RamsHazard[];
}

export interface FormCompleteness {
  complete: boolean;
  missing: string[];
}

export interface FormTemplate {
  id: string;
  name: string;
  form_type: FormType;
  description: string | null;
  content: RamsContent;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormDocument {
  id: string;
  template_id: string | null;
  deployment_id: string | null;
  form_type: FormType;
  title: string;
  reference: string | null;
  site_name: string | null;
  prepared_by: string | null;
  content: RamsContent;
  status: 'draft' | 'issued' | 'archived';
  version: number;
  issued_at: string | null;
  completeness: FormCompleteness;
  highest_residual: 'low' | 'medium' | 'high' | null;
  created_at: string;
  updated_at: string;
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
