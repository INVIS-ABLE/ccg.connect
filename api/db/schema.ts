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
  kind: text('kind', { enum: ['direct', 'job'] }).notNull().default('direct'),
  // For direct chats: canonical sorted "userA__userB". For job chats: "job:<id>".
  // Either way it's the one-row-per-conversation uniqueness key.
  pair_key: text('pair_key').notNull().unique(),
  // Populated for direct chats; null for job chats (participants are derived).
  a_user_id: text('a_user_id'),
  b_user_id: text('b_user_id'),
  // Job chats only: the job this room belongs to, and a display title.
  job_id: text('job_id'),
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
