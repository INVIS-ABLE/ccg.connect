import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

/**
 * Cloudflare D1 schema (Drizzle) — Phase 1 of the migration off Base44.
 *
 * Translated 1:1 from base44/entities/*.jsonc. Field names are kept identical to
 * Base44 so data migrates cleanly (Phase 5). Conventions:
 *   - `id` text primary key (string ids, matching Base44)
 *   - `created_at` / `updated_at` epoch-seconds timestamps managed by the app
 *   - enums → `text({ enum })` for literal-union types; booleans → integer bool;
 *     date / date-time values stored as ISO `text` (as Base44 returns them)
 *   - relations expressed as `<entity>_id` text columns (FKs enforced in the API)
 *
 * Base44's platform `User` (role admin|user) is intentionally NOT modelled here —
 * authentication/users are owned by Better Auth in Phase 2. `UserProfile` carries
 * the app role (`owner | ops_admin | contractor | client`).
 */

const pk = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date());
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// ── Identity / profile ──────────────────────────────────────────────────────

export const userProfiles = sqliteTable('user_profiles', {
  id: pk(),
  user_id: text('user_id').notNull(),
  role: text('role', { enum: ['owner', 'ops_admin', 'contractor', 'client'] })
    .notNull()
    .default('contractor'),
  // Links a client user to their Client org (set by an admin). Drives client
  // data scoping in the API; null for non-client users.
  client_id: text('client_id'),
  first_name: text('first_name'),
  last_name: text('last_name'),
  display_name: text('display_name'),
  email: text('email'),
  phone: text('phone'),
  profile_photo_url: text('profile_photo_url'),
  account_status: text('account_status', {
    enum: ['active', 'pending', 'suspended', 'archived'],
  })
    .notNull()
    .default('pending'),
  preferred_contact_method: text('preferred_contact_method', {
    enum: ['phone', 'email', 'sms', 'whatsapp'],
  }),
  onboarding_completed_at: text('onboarding_completed_at'),
  last_active_at: text('last_active_at'),
  terms_accepted_at: text('terms_accepted_at'),
  privacy_accepted_at: text('privacy_accepted_at'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

// Contact / billing / site addresses for a user. A client may have many sites;
// addresses are kept separate from the profile. privacy_level gates exposure.
export const contactAddresses = sqliteTable('contact_addresses', {
  id: pk(),
  user_id: text('user_id').notNull(),
  address_type: text('address_type', { enum: ['contact', 'billing', 'site'] })
    .notNull()
    .default('contact'),
  line_1: text('line_1'),
  line_2: text('line_2'),
  town_city: text('town_city'),
  county: text('county'),
  postcode: text('postcode'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  is_primary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  privacy_level: text('privacy_level', { enum: ['private', 'job_visible', 'public'] })
    .notNull()
    .default('private'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

// ── Reference data ──────────────────────────────────────────────────────────

export const skills = sqliteTable('skills', {
  id: pk(),
  name: text('name').notNull(),
  category: text('category'),
  description: text('description'),
  synonyms: text('synonyms'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const credentialTypes = sqliteTable('credential_types', {
  id: pk(),
  name: text('name').notNull(),
  category: text('category', {
    enum: [
      'safety_card',
      'gas_registration',
      'trade_qualification',
      'working_at_height',
      'asbestos',
      'first_aid',
      'management',
      'insurance',
      'other',
    ],
  }),
  requires_expiry: integer('requires_expiry', { mode: 'boolean' }).notNull().default(true),
  verification_url_template: text('verification_url_template'),
  default_client_visible: integer('default_client_visible', { mode: 'boolean' })
    .notNull()
    .default(false),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const checklistTemplates = sqliteTable('checklist_templates', {
  id: pk(),
  name: text('name').notNull(),
  job_type: text('job_type'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const checklistTemplateItems = sqliteTable('checklist_template_items', {
  id: pk(),
  template_id: text('template_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  required: integer('required', { mode: 'boolean' }).notNull().default(true),
  display_order: integer('display_order').notNull().default(0),
  requires_file: integer('requires_file', { mode: 'boolean' }).notNull().default(false),
  requires_signature: integer('requires_signature', { mode: 'boolean' })
    .notNull()
    .default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

// ── Contractors ─────────────────────────────────────────────────────────────

export const contractorProfiles = sqliteTable('contractor_profiles', {
  id: pk(),
  user_id: text('user_id').notNull(),
  contractor_reference: text('contractor_reference'),
  approval_status: text('approval_status', {
    enum: ['pending', 'approved', 'suspended', 'rejected', 'archived'],
  })
    .notNull()
    .default('pending'),
  trading_name: text('trading_name'),
  legal_name: text('legal_name'),
  company_number: text('company_number'),
  tax_or_vat_reference: text('tax_or_vat_reference'),
  primary_trade: text('primary_trade'),
  biography: text('biography'),
  base_postcode: text('base_postcode'),
  postcode_district: text('postcode_district'),
  // Geocoded from base_postcode (see api/lib/geocode.ts) — drives map pins and
  // the distance component of matching.
  latitude: real('latitude'),
  longitude: real('longitude'),
  service_radius_miles: real('service_radius_miles'),
  maximum_travel_miles: real('maximum_travel_miles'),
  transport_available: integer('transport_available', { mode: 'boolean' })
    .notNull()
    .default(true),
  day_rate: real('day_rate'),
  hourly_rate: real('hourly_rate'),
  availability_status: text('availability_status', {
    enum: ['available', 'partially_available', 'unavailable', 'on_assignment'],
  })
    .notNull()
    .default('available'),
  preferred_contractor: integer('preferred_contractor', { mode: 'boolean' })
    .notNull()
    .default(false),
  internal_risk_status: text('internal_risk_status', {
    enum: ['low', 'medium', 'high', 'blocked'],
  })
    .notNull()
    .default('low'),
  private_admin_notes: text('private_admin_notes'),
  onboarding_completed: integer('onboarding_completed', { mode: 'boolean' })
    .notNull()
    .default(false),
  approved_by: text('approved_by'),
  approved_at: text('approved_at'),
  suspended_reason: text('suspended_reason'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const contractorSkills = sqliteTable('contractor_skills', {
  id: pk(),
  contractor_id: text('contractor_id').notNull(),
  skill_id: text('skill_id').notNull(),
  proficiency_level: text('proficiency_level', {
    enum: ['beginner', 'intermediate', 'experienced', 'expert'],
  })
    .notNull()
    .default('experienced'),
  years_experience: real('years_experience'),
  primary_skill: integer('primary_skill', { mode: 'boolean' }).notNull().default(false),
  admin_verified: integer('admin_verified', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const contractorAvailability = sqliteTable('contractor_availability', {
  id: pk(),
  contractor_id: text('contractor_id').notNull(),
  start_date: text('start_date').notNull(),
  end_date: text('end_date'),
  availability_type: text('availability_type', {
    enum: ['available', 'partially_available', 'unavailable', 'on_assignment', 'holiday'],
  })
    .notNull()
    .default('available'),
  all_day: integer('all_day', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  recurring_pattern: text('recurring_pattern'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const contractorCredentials = sqliteTable('contractor_credentials', {
  id: pk(),
  contractor_id: text('contractor_id').notNull(),
  credential_type_id: text('credential_type_id').notNull(),
  issuer: text('issuer'),
  registration_or_policy_number: text('registration_or_policy_number'),
  issue_date: text('issue_date'),
  expiry_date: text('expiry_date'),
  file_url: text('file_url'),
  verification_status: text('verification_status', {
    enum: ['awaiting_review', 'verified', 'rejected', 'expired', 'superseded'],
  })
    .notNull()
    .default('awaiting_review'),
  verification_source: text('verification_source'),
  verified_by: text('verified_by'),
  verified_at: text('verified_at'),
  rejection_reason: text('rejection_reason'),
  visibility: text('visibility', {
    enum: ['admin_only', 'shareable_by_admin', 'shared_with_client', 'contractor_and_admin'],
  })
    .notNull()
    .default('contractor_and_admin'),
  reminder_60_sent: integer('reminder_60_sent', { mode: 'boolean' }).notNull().default(false),
  reminder_30_sent: integer('reminder_30_sent', { mode: 'boolean' }).notNull().default(false),
  reminder_14_sent: integer('reminder_14_sent', { mode: 'boolean' }).notNull().default(false),
  reminder_7_sent: integer('reminder_7_sent', { mode: 'boolean' }).notNull().default(false),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

// ── Clients & leads ─────────────────────────────────────────────────────────

export const clients = sqliteTable('clients', {
  id: pk(),
  client_reference: text('client_reference'),
  client_type: text('client_type', {
    enum: ['individual', 'company', 'housing_association', 'local_authority', 'other'],
  })
    .notNull()
    .default('company'),
  individual_or_company_name: text('individual_or_company_name').notNull(),
  main_contact_name: text('main_contact_name'),
  email: text('email'),
  phone: text('phone'),
  billing_email: text('billing_email'),
  billing_address: text('billing_address'),
  default_site_address: text('default_site_address'),
  default_postcode: text('default_postcode'),
  account_status: text('account_status', { enum: ['active', 'inactive', 'suspended'] })
    .notNull()
    .default('active'),
  portal_enabled: integer('portal_enabled', { mode: 'boolean' }).notNull().default(false),
  private_admin_notes: text('private_admin_notes'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const leads = sqliteTable('leads', {
  id: pk(),
  name: text('name').notNull(),
  company: text('company'),
  email: text('email').notNull(),
  phone: text('phone'),
  site_postcode: text('site_postcode'),
  work_type: text('work_type'),
  description: text('description'),
  desired_dates: text('desired_dates'),
  preferred_contact_method: text('preferred_contact_method', {
    enum: ['email', 'phone', 'either'],
  })
    .notNull()
    .default('either'),
  attachment_urls: text('attachment_urls'),
  consent: integer('consent', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['new', 'contacted', 'qualified', 'converted', 'rejected'] })
    .notNull()
    .default('new'),
  converted_job_id: text('converted_job_id'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

// ── Jobs ────────────────────────────────────────────────────────────────────

export const jobs = sqliteTable('jobs', {
  id: pk(),
  job_reference: text('job_reference'),
  client_id: text('client_id'),
  title: text('title').notNull(),
  short_description: text('short_description'),
  full_scope: text('full_scope'),
  site_address: text('site_address'),
  site_postcode: text('site_postcode'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  trade_category: text('trade_category'),
  urgency: text('urgency', { enum: ['low', 'medium', 'high', 'emergency'] })
    .notNull()
    .default('medium'),
  start_date: text('start_date'),
  end_date: text('end_date'),
  estimated_duration: text('estimated_duration'),
  budget: real('budget'),
  hourly_rate: real('hourly_rate'),
  day_rate: real('day_rate'),
  headcount_required: integer('headcount_required').notNull().default(1),
  // Job classification: domestic (homeowner) vs commercial (business/contract).
  sector: text('sector', { enum: ['domestic', 'commercial'] }),
  // Internal cost breakdown. materials is a JSON array of
  // { description, qty, unit_cost }; labour_cost is the total labour figure.
  materials: text('materials'),
  labour_cost: real('labour_cost'),
  status: text('status', {
    enum: [
      'new_lead',
      'draft',
      'ready_to_match',
      'offers_sent',
      'assigned',
      'in_progress',
      'on_hold',
      'awaiting_contractor_action',
      'awaiting_client_approval',
      'snagging',
      'completed',
      'cancelled',
    ],
  })
    .notNull()
    .default('draft'),
  client_contact_name: text('client_contact_name'),
  client_contact_phone: text('client_contact_phone'),
  access_instructions: text('access_instructions'),
  parking_instructions: text('parking_instructions'),
  health_and_safety_notes: text('health_and_safety_notes'),
  internal_notes: text('internal_notes'),
  client_visible_notes: text('client_visible_notes'),
  assignment_locked: integer('assignment_locked', { mode: 'boolean' }).notNull().default(false),
  created_from_lead: text('created_from_lead'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const jobRequiredSkills = sqliteTable('job_required_skills', {
  id: pk(),
  job_id: text('job_id').notNull(),
  skill_id: text('skill_id').notNull(),
  required_level: text('required_level', {
    enum: ['any', 'intermediate', 'experienced', 'expert'],
  })
    .notNull()
    .default('any'),
  mandatory: integer('mandatory', { mode: 'boolean' }).notNull().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const jobRequiredCredentials = sqliteTable('job_required_credentials', {
  id: pk(),
  job_id: text('job_id').notNull(),
  credential_type_id: text('credential_type_id').notNull(),
  mandatory: integer('mandatory', { mode: 'boolean' }).notNull().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const jobMatches = sqliteTable('job_matches', {
  id: pk(),
  job_id: text('job_id').notNull(),
  contractor_id: text('contractor_id').notNull(),
  eligibility_status: text('eligibility_status', { enum: ['eligible', 'ineligible'] })
    .notNull()
    .default('eligible'),
  total_score: real('total_score'),
  skill_score: real('skill_score'),
  distance_score: real('distance_score'),
  availability_score: real('availability_score'),
  credential_score: real('credential_score'),
  delivery_history_score: real('delivery_history_score'),
  admin_preference_score: real('admin_preference_score'),
  explanation: text('explanation'),
  offer_status: text('offer_status', {
    enum: [
      'not_sent',
      'sent',
      'viewed',
      'accepted',
      'declined',
      'expired',
      'withdrawn',
      'assigned_elsewhere',
    ],
  })
    .notNull()
    .default('not_sent'),
  notified_at: text('notified_at'),
  viewed_at: text('viewed_at'),
  responded_at: text('responded_at'),
  decline_reason: text('decline_reason'),
  contractor_message: text('contractor_message'),
  selected_by_admin: integer('selected_by_admin', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const jobAssignments = sqliteTable('job_assignments', {
  id: pk(),
  job_id: text('job_id').notNull(),
  contractor_id: text('contractor_id').notNull(),
  assignment_status: text('assignment_status', {
    enum: ['active', 'completed', 'cancelled', 'suspended'],
  })
    .notNull()
    .default('active'),
  agreed_rate_type: text('agreed_rate_type', { enum: ['hourly', 'daily', 'fixed'] })
    .notNull()
    .default('daily'),
  agreed_rate: real('agreed_rate'),
  planned_start: text('planned_start'),
  planned_finish: text('planned_finish'),
  actual_start: text('actual_start'),
  actual_finish: text('actual_finish'),
  assigned_by: text('assigned_by'),
  assigned_at: text('assigned_at'),
  cancellation_reason: text('cancellation_reason'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

/**
 * On-site check-ins (QR clock-in/out). A contractor scans the job's QR code on
 * arrival/departure; we record the time and (with permission) their location as
 * site evidence. contractor_id is the assigned contractor when known; user_id is
 * always the person who checked in.
 */
export const jobCheckins = sqliteTable(
  'job_checkins',
  {
    id: pk(),
    job_id: text('job_id').notNull(),
    contractor_id: text('contractor_id'),
    user_id: text('user_id').notNull(),
    check_type: text('check_type', { enum: ['arrival', 'departure'] }).notNull().default('arrival'),
    checked_in_at: text('checked_in_at').notNull(),
    latitude: real('latitude'),
    longitude: real('longitude'),
    accuracy_m: real('accuracy_m'),
    note: text('note'),
    created_at: createdAt(),
  },
  (t) => ({
    byJob: index('ix_checkin_job').on(t.job_id),
  }),
);

export const jobThreads = sqliteTable('job_threads', {
  id: pk(),
  job_id: text('job_id').notNull(),
  thread_type: text('thread_type', {
    enum: ['internal_operations', 'contractor', 'client'],
  })
    .notNull()
    .default('internal_operations'),
  client_visible: integer('client_visible', { mode: 'boolean' }).notNull().default(false),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const jobMessages = sqliteTable('job_messages', {
  id: pk(),
  thread_id: text('thread_id').notNull(),
  job_id: text('job_id').notNull(),
  sender_user_id: text('sender_user_id').notNull(),
  message_text: text('message_text'),
  message_type: text('message_type', { enum: ['text', 'image', 'document', 'system'] })
    .notNull()
    .default('text'),
  attachment_url: text('attachment_url'),
  client_visible: integer('client_visible', { mode: 'boolean' }).notNull().default(false),
  internal_only: integer('internal_only', { mode: 'boolean' }).notNull().default(false),
  reply_to_message_id: text('reply_to_message_id'),
  sent_at: text('sent_at'),
  edited_at: text('edited_at'),
  read_at: text('read_at'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const jobMedia = sqliteTable('job_media', {
  id: pk(),
  job_id: text('job_id').notNull(),
  uploaded_by: text('uploaded_by').notNull(),
  contractor_id: text('contractor_id'),
  client_id: text('client_id'),
  media_type: text('media_type', { enum: ['image', 'video', 'document'] })
    .notNull()
    .default('image'),
  category: text('category', {
    enum: [
      'before',
      'progress',
      'completion',
      'materials',
      'delivery',
      'variation',
      'defect',
      'snagging',
      'incident',
      'other',
    ],
  })
    .notNull()
    .default('progress'),
  file_url: text('file_url').notNull(),
  thumbnail_url: text('thumbnail_url'),
  original_filename: text('original_filename'),
  caption: text('caption'),
  captured_at: text('captured_at'),
  uploaded_at: text('uploaded_at'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  client_visible: integer('client_visible', { mode: 'boolean' }).notNull().default(false),
  internal_only: integer('internal_only', { mode: 'boolean' }).notNull().default(false),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const jobDocuments = sqliteTable('job_documents', {
  id: pk(),
  job_id: text('job_id').notNull(),
  document_type: text('document_type', {
    enum: [
      'job_brief',
      'contract',
      'variation',
      'sign_off',
      'invoice',
      'timesheet',
      'credential_pack',
      'other',
    ],
  }),
  title: text('title').notNull(),
  file_url: text('file_url'),
  uploaded_by: text('uploaded_by'),
  version: integer('version').notNull().default(1),
  approval_status: text('approval_status', {
    enum: ['draft', 'pending_approval', 'approved', 'rejected'],
  })
    .notNull()
    .default('draft'),
  client_visible: integer('client_visible', { mode: 'boolean' }).notNull().default(false),
  contractor_visible: integer('contractor_visible', { mode: 'boolean' })
    .notNull()
    .default(false),
  signed_at: text('signed_at'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const jobChecklistItems = sqliteTable('job_checklist_items', {
  id: pk(),
  job_id: text('job_id').notNull(),
  template_item_id: text('template_item_id'),
  status: text('status', { enum: ['pending', 'completed', 'not_applicable', 'failed'] })
    .notNull()
    .default('pending'),
  completed_by: text('completed_by'),
  completed_at: text('completed_at'),
  notes: text('notes'),
  evidence_url: text('evidence_url'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

// ── Timesheets & invoices ───────────────────────────────────────────────────

export const timesheets = sqliteTable('timesheets', {
  id: pk(),
  job_id: text('job_id').notNull(),
  contractor_id: text('contractor_id').notNull(),
  week_start: text('week_start').notNull(),
  status: text('status', {
    enum: ['draft', 'submitted', 'needs_correction', 'approved', 'exported', 'paid', 'disputed'],
  })
    .notNull()
    .default('draft'),
  submitted_at: text('submitted_at'),
  reviewed_by: text('reviewed_by'),
  reviewed_at: text('reviewed_at'),
  rejection_reason: text('rejection_reason'),
  total_hours: real('total_hours'),
  total_amount: real('total_amount'),
  exported_at: text('exported_at'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const timesheetEntries = sqliteTable('timesheet_entries', {
  id: pk(),
  timesheet_id: text('timesheet_id').notNull(),
  work_date: text('work_date').notNull(),
  start_time: text('start_time'),
  finish_time: text('finish_time'),
  break_minutes: integer('break_minutes').notNull().default(0),
  total_hours: real('total_hours'),
  rate: real('rate'),
  description: text('description'),
  evidence_url: text('evidence_url'),
  contractor_signature: text('contractor_signature'),
  client_signature: text('client_signature'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const invoices = sqliteTable('invoices', {
  id: pk(),
  job_id: text('job_id').notNull(),
  contractor_id: text('contractor_id'),
  client_id: text('client_id'),
  invoice_number: text('invoice_number'),
  invoice_type: text('invoice_type', { enum: ['contractor_to_ccg', 'ccg_to_client'] })
    .notNull()
    .default('contractor_to_ccg'),
  issue_date: text('issue_date'),
  due_date: text('due_date'),
  net_amount: real('net_amount'),
  vat_rate: real('vat_rate').notNull().default(20),
  vat_amount: real('vat_amount'),
  gross_amount: real('gross_amount'),
  status: text('status', {
    enum: ['draft', 'submitted', 'approved', 'sent', 'paid', 'overdue', 'disputed', 'cancelled'],
  })
    .notNull()
    .default('draft'),
  file_url: text('file_url'),
  linked_timesheet_ids: text('linked_timesheet_ids'),
  exported_to: text('exported_to'),
  external_reference: text('external_reference'),
  payment_date: text('payment_date'),
  notes: text('notes'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

// ── Calendar, notifications, audit ──────────────────────────────────────────

export const calendarEvents = sqliteTable('calendar_events', {
  id: pk(),
  title: text('title').notNull(),
  description: text('description'),
  event_type: text('event_type', {
    enum: [
      'job_start',
      'job_end',
      'site_visit',
      'contractor_unavailable',
      'client_meeting',
      'compliance_deadline',
      'other',
    ],
  })
    .notNull()
    .default('other'),
  start_datetime: text('start_datetime').notNull(),
  end_datetime: text('end_datetime'),
  all_day: integer('all_day', { mode: 'boolean' }).notNull().default(false),
  job_id: text('job_id'),
  contractor_id: text('contractor_id'),
  client_id: text('client_id'),
  location: text('location'),
  colour: text('colour').notNull().default('orange'),
  visible_to_contractor: integer('visible_to_contractor', { mode: 'boolean' })
    .notNull()
    .default(true),
  visible_to_client: integer('visible_to_client', { mode: 'boolean' }).notNull().default(false),
  created_by: text('created_by'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const notifications = sqliteTable('notifications', {
  id: pk(),
  user_id: text('user_id').notNull(),
  job_id: text('job_id'),
  notification_type: text('notification_type'),
  title: text('title').notNull(),
  body: text('body'),
  deep_link: text('deep_link'),
  channel: text('channel', { enum: ['in_app', 'email', 'sms', 'whatsapp', 'push'] })
    .notNull()
    .default('in_app'),
  delivery_status: text('delivery_status', {
    enum: ['pending', 'sent', 'delivered', 'failed'],
  })
    .notNull()
    .default('pending'),
  sent_at: text('sent_at'),
  read_at: text('read_at'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const auditEvents = sqliteTable('audit_events', {
  id: pk(),
  actor_user_id: text('actor_user_id'),
  action: text('action').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id'),
  previous_values: text('previous_values'),
  new_values: text('new_values'),
  timestamp: text('timestamp'),
  reason: text('reason'),
  correlation_id: text('correlation_id'),
  created_at: createdAt(),
});

// ── Quotes ───────────────────────────────────────────────────────────────────
export const quotes = sqliteTable('quotes', {
  id: pk(),
  job_id: text('job_id'),
  client_id: text('client_id'),
  quote_number: text('quote_number'),
  recipient_name: text('recipient_name'),
  status: text('status', { enum: ['draft', 'sent', 'accepted', 'declined', 'expired'] })
    .notNull()
    .default('draft'),
  // Line items stored as a JSON array string: [{description, qty, unitPrice}].
  line_items: text('line_items'),
  net_amount: real('net_amount'),
  vat_rate: real('vat_rate').notNull().default(20),
  vat_amount: real('vat_amount'),
  gross_amount: real('gross_amount'),
  valid_until: text('valid_until'),
  notes: text('notes'),
  created_by: text('created_by'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

// ── Direct messaging (1:1 chat) ──────────────────────────────────────────────
// People-centric WhatsApp-style chat between two users. Authorization (who may
// talk to whom) lives in src/domain/permissions (hub-and-spoke around admins).

export const conversations = sqliteTable('conversations', {
  id: pk(),
  // 'direct' = 1:1 between a_user_id/b_user_id. 'job' = a job delivery-team room
  // (ops + the contractors assigned to job_id); membership is derived, not stored.
  kind: text('kind', { enum: ['direct', 'job', 'site'] }).notNull().default('direct'),
  // For direct chats: canonical sorted "userA__userB". For job chats: "job:<id>".
  // For site chats: "deployment:<id>". One-row-per-conversation uniqueness key.
  pair_key: text('pair_key').notNull().unique(),
  // Populated for direct chats; null for job/site chats (participants derived).
  a_user_id: text('a_user_id'),
  b_user_id: text('b_user_id'),
  // Job chats only: the job this room belongs to, and a display title.
  job_id: text('job_id'),
  // Site chats only: the deployment this room belongs to.
  deployment_id: text('deployment_id'),
  title: text('title'),
  last_message_at: text('last_message_at'),
  last_message_preview: text('last_message_preview'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

/**
 * Per-user preferences for a conversation (pin to top, mute notifications).
 * Each participant has their own row, so pinning/muting is private to them and
 * never visible to the other party. One row per (conversation, user).
 */
export const conversationPrefs = sqliteTable(
  'conversation_prefs',
  {
    id: pk(),
    conversation_id: text('conversation_id').notNull(),
    user_id: text('user_id').notNull(),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    muted: integer('muted', { mode: 'boolean' }).notNull().default(false),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({
    uniqByConvUser: uniqueIndex('ux_convpref_conv_user').on(t.conversation_id, t.user_id),
    byUser: index('ix_convpref_user').on(t.user_id),
  }),
);

export const directMessages = sqliteTable('direct_messages', {
  id: pk(),
  conversation_id: text('conversation_id').notNull(),
  sender_user_id: text('sender_user_id').notNull(),
  body: text('body').notNull(),
  // Optional attachment (image / file / voice note). attachment_key is the R2
  // object key — never exposed; served via the authorized attachment route.
  attachment_key: text('attachment_key'),
  attachment_type: text('attachment_type', { enum: ['image', 'file', 'audio'] }),
  attachment_name: text('attachment_name'),
  attachment_mime: text('attachment_mime'),
  // Quoted reply: the id of an earlier message in the same conversation, or null.
  reply_to_id: text('reply_to_id'),
  // Set when the *other* participant has read it (drives unread badges).
  read_at: text('read_at'),
  created_at: createdAt(),
});

/**
 * Emoji reactions on a direct message. One row per (message, user, emoji); a
 * user toggling the same emoji twice removes their reaction. `conversation_id`
 * is denormalised so participant checks and per-conversation cleanup stay
 * single-query.
 */
export const messageReactions = sqliteTable(
  'message_reactions',
  {
    id: pk(),
    message_id: text('message_id').notNull(),
    conversation_id: text('conversation_id').notNull(),
    user_id: text('user_id').notNull(),
    emoji: text('emoji').notNull(),
    created_at: createdAt(),
  },
  (t) => ({
    // A user may apply each emoji to a message at most once (toggle semantics).
    uniqByUserEmoji: uniqueIndex('ux_reaction_msg_user_emoji').on(t.message_id, t.user_id, t.emoji),
    byMessage: index('ix_reaction_message').on(t.message_id),
  }),
);

// ── Commercial / agency (labour supply) ──────────────────────────────────────
// Enterprise corporate structure: Corporate account → Project → Site (→ later:
// labour requests → deployments → shifts → timesheets). Distinct from the simple
// `clients` model so a national contractor can have many divisions, projects,
// approvers and rate cards. Internal/admin-managed.

export const corporateAccounts = sqliteTable('corporate_accounts', {
  id: pk(),
  legal_name: text('legal_name').notNull(),
  trading_name: text('trading_name'),
  registration_number: text('registration_number'),
  status: text('status', { enum: ['prospect', 'active', 'inactive'] }).notNull().default('active'),
  // Captured for professional tax review — never used to auto-decide status.
  vat_treatment: text('vat_treatment'),
  cis_treatment: text('cis_treatment'),
  payment_terms: text('payment_terms'),
  framework_agreement: text('framework_agreement'),
  insurance_requirements: text('insurance_requirements'),
  required_accreditations: text('required_accreditations'),
  invoice_instructions: text('invoice_instructions'),
  supplier_portal_reference: text('supplier_portal_reference'),
  data_retention_note: text('data_retention_note'),
  notes: text('notes'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

// Named contacts on a corporate account (commercial, procurement, accounts, …).
export const corporateContacts = sqliteTable(
  'corporate_contacts',
  {
    id: pk(),
    account_id: text('account_id').notNull(),
    name: text('name').notNull(),
    role: text('role', {
      enum: ['commercial', 'procurement', 'accounts', 'site', 'other'],
    })
      .notNull()
      .default('other'),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byAccount: index('ix_corpcontact_account').on(t.account_id) }),
);

// Links a client *login* (user_profiles user_id) to the corporate account(s) it
// may view in the commercial portal. Granting portal access is an admin action;
// a client can only ever see accounts they are explicitly linked to here. A
// join table (not a single column) so an account can have several portal users
// and a user can hold several accounts.
export const corporateAccountUsers = sqliteTable(
  'corporate_account_users',
  {
    id: pk(),
    account_id: text('account_id').notNull(),
    user_id: text('user_id').notNull(),
    granted_by: text('granted_by'),
    created_at: createdAt(),
  },
  (t) => ({
    byUser: index('ix_cau_user').on(t.user_id),
    uniqLink: uniqueIndex('ux_cau_account_user').on(t.account_id, t.user_id),
  }),
);

export const commercialProjects = sqliteTable(
  'commercial_projects',
  {
    id: pk(),
    account_id: text('account_id').notNull(),
    name: text('name').notNull(),
    project_number: text('project_number'),
    region_division: text('region_division'),
    status: text('status', { enum: ['active', 'on_hold', 'completed', 'cancelled'] })
      .notNull()
      .default('active'),
    notes: text('notes'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byAccount: index('ix_project_account').on(t.account_id) }),
);

export const commercialSites = sqliteTable(
  'commercial_sites',
  {
    id: pk(),
    project_id: text('project_id').notNull(),
    account_id: text('account_id').notNull(),
    name: text('name').notNull(),
    site_address: text('site_address'),
    postcode: text('postcode'),
    what3words: text('what3words'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    principal_contractor: text('principal_contractor'),
    site_manager: text('site_manager'),
    commercial_manager: text('commercial_manager'),
    working_hours: text('working_hours'),
    parking_access: text('parking_access'),
    induction_instructions: text('induction_instructions'),
    ppe_requirements: text('ppe_requirements'),
    drug_alcohol_policy: text('drug_alcohol_policy'),
    emergency_arrangements: text('emergency_arrangements'),
    welfare_info: text('welfare_info'),
    site_rules: text('site_rules'),
    required_cards: text('required_cards'),
    prohibited_activities: text('prohibited_activities'),
    check_in_method: text('check_in_method', {
      enum: ['qr', 'geofence', 'roll_call', 'supervisor', 'manual'],
    }),
    // Geofence radius (metres) around the site lat/long. When set, QR check-ins
    // are flagged inside/outside — advisory evidence only, never a hard gate
    // (poor signal, large sites; an authorised roll-call always overrides).
    geofence_radius_m: real('geofence_radius_m'),
    po_number: text('po_number'),
    cost_code: text('cost_code'),
    status: text('status', { enum: ['active', 'completed', 'suspended'] })
      .notNull()
      .default('active'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({
    byProject: index('ix_site_project').on(t.project_id),
    byAccount: index('ix_site_account').on(t.account_id),
  }),
);

// ── Workforce (individual operatives) ────────────────────────────────────────
// A worker is an individual operative, distinct from a contractor *company*: a
// supplier may provide many workers, while a sole trader is both. Sensitive
// payroll/identity data (NI, UTR, bank) is deliberately NOT stored here yet — it
// must live behind separate, stricter access control (a later slice).

export const workers = sqliteTable(
  'workers',
  {
    id: pk(),
    full_name: text('full_name').notNull(),
    photo_url: text('photo_url'),
    mobile: text('mobile'),
    email: text('email'),
    home_address: text('home_address'),
    base_postcode: text('base_postcode'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    emergency_contact_name: text('emergency_contact_name'),
    emergency_contact_phone: text('emergency_contact_phone'),
    right_to_work_status: text('right_to_work_status', {
      enum: ['unchecked', 'checked', 'expired', 'restricted'],
    })
      .notNull()
      .default('unchecked'),
    rtw_check_date: text('rtw_check_date'),
    rtw_checked_by: text('rtw_checked_by'),
    rtw_expiry: text('rtw_expiry'),
    // Payment model — captured for payroll/tax review, never auto-determined.
    payment_model: text('payment_model', { enum: ['paye', 'cis', 'umbrella', 'limited'] }),
    primary_trade: text('primary_trade'),
    additional_skills: text('additional_skills'),
    experience_years: real('experience_years'),
    driving_licence: text('driving_licence'),
    plant_tickets: text('plant_tickets'),
    preferred_travel_miles: real('preferred_travel_miles'),
    day_rate: real('day_rate'),
    hourly_rate: real('hourly_rate'),
    // The contractor company that supplies this worker (null for direct/sole trader).
    contractor_id: text('contractor_id'),
    // App login, if the worker has one.
    user_id: text('user_id'),
    status: text('status', { enum: ['active', 'inactive', 'archived'] }).notNull().default('active'),
    notes: text('notes'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byContractor: index('ix_worker_contractor').on(t.contractor_id) }),
);

// Cards / qualifications / tickets / medicals held by a worker. Drives the
// compliance matrix (each requires individual verification — a gang grouping
// never substitutes for per-operative checks).
export const workerCards = sqliteTable(
  'worker_cards',
  {
    id: pk(),
    worker_id: text('worker_id').notNull(),
    card_type: text('card_type').notNull(),
    reference: text('reference'),
    issuer: text('issuer'),
    issue_date: text('issue_date'),
    expiry_date: text('expiry_date'),
    verification_status: text('verification_status', {
      enum: ['unverified', 'verified', 'rejected', 'expired'],
    })
      .notNull()
      .default('unverified'),
    file_url: text('file_url'),
    notes: text('notes'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byWorker: index('ix_card_worker').on(t.worker_id) }),
);

// Gangs: a reusable operational grouping of workers under a gang leader. NOT a
// compliance shortcut — every member still needs individual checks.
export const gangs = sqliteTable('gangs', {
  id: pk(),
  name: text('name').notNull(),
  gang_leader_worker_id: text('gang_leader_worker_id'),
  base_postcode: text('base_postcode'),
  service_radius_miles: real('service_radius_miles'),
  usual_day_rate: real('usual_day_rate'),
  vehicles: text('vehicles'),
  plant_capability: text('plant_capability'),
  notes: text('notes'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const gangMembers = sqliteTable(
  'gang_members',
  {
    id: pk(),
    gang_id: text('gang_id').notNull(),
    worker_id: text('worker_id').notNull(),
    role: text('role', { enum: ['leader', 'permanent', 'reserve'] }).notNull().default('permanent'),
    created_at: createdAt(),
  },
  (t) => ({
    byGang: index('ix_gangmember_gang').on(t.gang_id),
    uniqMember: uniqueIndex('ux_gangmember_gang_worker').on(t.gang_id, t.worker_id),
  }),
);

// ── Labour requests (commercial orders) ──────────────────────────────────────
// A corporate client's structured request for workers, against a project/site.
// employment_model is captured for CIS/PAYE/VAT review (never auto-decided).
export const labourRequests = sqliteTable(
  'labour_requests',
  {
    id: pk(),
    account_id: text('account_id').notNull(),
    project_id: text('project_id'),
    site_id: text('site_id'),
    title: text('title').notNull(),
    work_package: text('work_package'),
    trade: text('trade'),
    number_required: integer('number_required').notNull().default(1),
    gang_composition: text('gang_composition'),
    start_date: text('start_date'),
    finish_date: text('finish_date'),
    shift_pattern: text('shift_pattern'),
    minimum_qualifications: text('minimum_qualifications'),
    experience_required: text('experience_required'),
    employment_model: text('employment_model', {
      enum: ['labour_supply', 'managed_workforce', 'subcontract_work_package'],
    }),
    rate_offered: real('rate_offered'),
    charge_rate: real('charge_rate'),
    overtime_rate: real('overtime_rate'),
    travel_lodge_allowance: text('travel_lodge_allowance'),
    po_number: text('po_number'),
    urgency: text('urgency', { enum: ['low', 'medium', 'high', 'emergency'] }).notNull().default('medium'),
    replacement_sla: text('replacement_sla'),
    status: text('status', {
      enum: [
        'draft', 'awaiting_approval', 'open', 'sourcing', 'partially_filled',
        'fully_filled', 'confirmed', 'active', 'completed', 'cancelled',
      ],
    })
      .notNull()
      .default('draft'),
    notes: text('notes'),
    created_by: text('created_by'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({
    byAccount: index('ix_labreq_account').on(t.account_id),
    bySite: index('ix_labreq_site').on(t.site_id),
  }),
);

// ── Deployments ──────────────────────────────────────────────────────────────
// Connects workers (often a gang) to a labour request + site. On confirmation a
// compliance snapshot is frozen (evidence of what was checked before start) and
// a site group chat is auto-created.
export const deployments = sqliteTable(
  'deployments',
  {
    id: pk(),
    labour_request_id: text('labour_request_id').notNull(),
    account_id: text('account_id'),
    site_id: text('site_id'),
    gang_id: text('gang_id'),
    status: text('status', {
      enum: ['proposed', 'confirmed', 'active', 'completed', 'cancelled'],
    })
      .notNull()
      .default('proposed'),
    start_date: text('start_date'),
    finish_date: text('finish_date'),
    // JSON compliance matrix frozen at confirmation time.
    compliance_snapshot: text('compliance_snapshot'),
    confirmed_at: text('confirmed_at'),
    // The auto-created site group chat (conversations.id), set on confirm.
    conversation_id: text('conversation_id'),
    notes: text('notes'),
    created_by: text('created_by'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byRequest: index('ix_deploy_request').on(t.labour_request_id) }),
);

export const deploymentWorkers = sqliteTable(
  'deployment_workers',
  {
    id: pk(),
    deployment_id: text('deployment_id').notNull(),
    worker_id: text('worker_id').notNull(),
    role: text('role'),
    pay_rate: real('pay_rate'),
    charge_rate: real('charge_rate'),
    created_at: createdAt(),
  },
  (t) => ({
    byDeployment: index('ix_depworker_deployment').on(t.deployment_id),
    uniqMember: uniqueIndex('ux_depworker_deploy_worker').on(t.deployment_id, t.worker_id),
  }),
);

// Commercial timesheets — weekly hours per worker on a deployment, with the
// rates snapshotted so historical pay/charge/margin stay stable.
export const commercialTimesheets = sqliteTable(
  'commercial_timesheets',
  {
    id: pk(),
    deployment_id: text('deployment_id').notNull(),
    worker_id: text('worker_id').notNull(),
    week_start: text('week_start').notNull(),
    basic_hours: real('basic_hours').notNull().default(0),
    overtime_hours: real('overtime_hours').notNull().default(0),
    pay_rate: real('pay_rate'),
    charge_rate: real('charge_rate'),
    oncost_rate: real('oncost_rate'),
    overtime_multiplier: real('overtime_multiplier'),
    travel: real('travel'),
    lodge: real('lodge'),
    expenses: real('expenses'),
    deductions: real('deductions'),
    status: text('status', {
      enum: ['draft', 'submitted', 'site_confirmed', 'ops_approved', 'locked', 'invoiced', 'rejected'],
    })
      .notNull()
      .default('draft'),
    rejection_reason: text('rejection_reason'),
    notes: text('notes'),
    created_by: text('created_by'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byDeployment: index('ix_ts_deployment').on(t.deployment_id) }),
);

// Commercial (client) invoices generated from approved/locked timesheets.
export const commercialInvoices = sqliteTable(
  'commercial_invoices',
  {
    id: pk(),
    account_id: text('account_id'),
    deployment_id: text('deployment_id'),
    invoice_number: text('invoice_number'),
    period_start: text('period_start'),
    period_end: text('period_end'),
    line_items: text('line_items'),
    net_amount: real('net_amount').notNull().default(0),
    vat_rate: real('vat_rate').notNull().default(0.2),
    vat_amount: real('vat_amount').notNull().default(0),
    gross_amount: real('gross_amount').notNull().default(0),
    status: text('status', { enum: ['draft', 'issued', 'paid', 'cancelled'] }).notNull().default('draft'),
    notes: text('notes'),
    created_by: text('created_by'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byAccount: index('ix_cinv_account').on(t.account_id) }),
);

// Daily site attendance / roll-call per deployment worker. GPS is never the sole
// truth — an authorised confirmer can always set the status.
export const deploymentAttendance = sqliteTable(
  'deployment_attendance',
  {
    id: pk(),
    deployment_id: text('deployment_id').notNull(),
    worker_id: text('worker_id').notNull(),
    date: text('date').notNull(),
    status: text('status', { enum: ['present', 'late', 'absent', 'no_show'] }).notNull().default('present'),
    check_in_time: text('check_in_time'),
    check_out_time: text('check_out_time'),
    method: text('method', { enum: ['qr', 'geofence', 'roll_call', 'supervisor', 'manual'] }),
    // Location captured at QR check-in — evidence only, never the sole truth: an
    // authorised confirmer can always override the status (see roll-call).
    check_in_lat: real('check_in_lat'),
    check_in_lng: real('check_in_lng'),
    check_in_accuracy_m: real('check_in_accuracy_m'),
    // Geofence evaluation at check-in (null = not evaluated). Advisory only.
    geofence_ok: integer('geofence_ok', { mode: 'boolean' }),
    geofence_distance_m: real('geofence_distance_m'),
    confirmed_by: text('confirmed_by'),
    reason: text('reason'),
    replacement_needed: integer('replacement_needed', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({
    byDeploymentDate: index('ix_att_deploy_date').on(t.deployment_id, t.date),
    uniqPerDay: uniqueIndex('ux_att_deploy_worker_date').on(t.deployment_id, t.worker_id, t.date),
  }),
);

// Incidents — accidents, near misses, concerns, complaints. Linkable to a site,
// deployment, worker or gang. restricted_notes are admin-only (sensitive).
export const incidents = sqliteTable(
  'incidents',
  {
    id: pk(),
    type: text('type', {
      enum: [
        'accident', 'near_miss', 'safety_concern', 'behaviour', 'harassment',
        'discrimination', 'fatigue', 'welfare', 'equipment', 'client_complaint', 'worker_complaint',
      ],
    }).notNull(),
    severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).notNull().default('medium'),
    status: text('status', { enum: ['open', 'investigating', 'closed'] }).notNull().default('open'),
    account_id: text('account_id'),
    site_id: text('site_id'),
    deployment_id: text('deployment_id'),
    worker_id: text('worker_id'),
    gang_id: text('gang_id'),
    occurred_at: text('occurred_at'),
    description: text('description'),
    immediate_action: text('immediate_action'),
    witnesses: text('witnesses'),
    investigation: text('investigation'),
    outcome: text('outcome'),
    restricted_notes: text('restricted_notes'),
    urgent: integer('urgent', { mode: 'boolean' }).notNull().default(false),
    reported_by: text('reported_by'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({
    bySite: index('ix_incident_site').on(t.site_id),
    byDeployment: index('ix_incident_deployment').on(t.deployment_id),
  }),
);

// Daily site diary per deployment.
export const siteDiaryEntries = sqliteTable(
  'site_diary_entries',
  {
    id: pk(),
    deployment_id: text('deployment_id').notNull(),
    date: text('date').notNull(),
    weather: text('weather'),
    headcount: integer('headcount'),
    work_summary: text('work_summary'),
    deliveries: text('deliveries'),
    visitors: text('visitors'),
    issues: text('issues'),
    notes: text('notes'),
    created_by: text('created_by'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byDeployment: index('ix_diary_deployment').on(t.deployment_id) }),
);

// Replacement audit — who was swapped out for whom on a deployment, and why.
export const deploymentReplacements = sqliteTable(
  'deployment_replacements',
  {
    id: pk(),
    deployment_id: text('deployment_id').notNull(),
    original_worker_id: text('original_worker_id').notNull(),
    replacement_worker_id: text('replacement_worker_id'),
    reason: text('reason'),
    status: text('status', { enum: ['requested', 'filled', 'cancelled'] }).notNull().default('filled'),
    requested_by: text('requested_by'),
    filled_at: text('filled_at'),
    created_at: createdAt(),
  },
  (t) => ({ byDeployment: index('ix_repl_deployment').on(t.deployment_id) }),
);

// ── Forms: RAMS & Method Statements ──────────────────────────────────────────
// Reusable templates authored by ops; `content` is the JSON RamsContent shape
// (sections + hazard table) from src/domain/forms/rams.ts.
export const formTemplates = sqliteTable(
  'form_templates',
  {
    id: pk(),
    name: text('name').notNull(),
    form_type: text('form_type', { enum: ['rams', 'method_statement'] }).notNull().default('rams'),
    description: text('description'),
    content: text('content'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    created_by: text('created_by'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byType: index('ix_formtpl_type').on(t.form_type) }),
);

// A filled document, attached to a deployment. `content` is RamsContent JSON.
// Append-only in spirit: issuing freezes a version; further edits bump it.
export const formDocuments = sqliteTable(
  'form_documents',
  {
    id: pk(),
    template_id: text('template_id'),
    deployment_id: text('deployment_id'),
    form_type: text('form_type', { enum: ['rams', 'method_statement'] }).notNull().default('rams'),
    title: text('title').notNull(),
    reference: text('reference'),
    site_name: text('site_name'),
    prepared_by: text('prepared_by'),
    content: text('content'),
    status: text('status', { enum: ['draft', 'issued', 'archived'] }).notNull().default('draft'),
    version: integer('version').notNull().default(1),
    issued_at: text('issued_at'),
    created_by: text('created_by'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => ({ byDeployment: index('ix_formdoc_deployment').on(t.deployment_id) }),
);
