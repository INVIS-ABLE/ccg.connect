import type {
  Job,
  JobAssignment,
  UserProfile,
  Principal,
  Contractor,
  Client,
  Lead,
  Timesheet,
  Invoice,
  MatchCandidate,
  AppNotification,
  JobMediaItem,
  DeploymentMediaItem,
  CredentialType,
  ContractorCredential,
  Quote,
  JobCheckin,
  CorporateAccount,
  CorporateContact,
  RateCard,
  SurchargeRule,
  CorporateAccountUser,
  PortalCommercial,
  WorkerPortal,
  FormType,
  FormTemplate,
  FormDocument,
  RamsContent,
  CommercialProject,
  CommercialSite,
  Worker,
  WorkerCard,
  Gang,
  GangMember,
  LabourRequest,
  Deployment,
  DeploymentMember,
  ComplianceCell,
  AttendanceRecord,
  CheckinContext,
  KidDocument,
  PerformanceReview,
  WorkerPerformanceSummary,
  DeploymentMaterial,
  MaterialRollup,
  CommercialTimesheet,
  CommercialInvoice,
  Incident,
  CommercialDashboard,
  SiteDiaryEntry,
  ReplacementCandidate,
  DeploymentReplacement,
  MessagingContact,
  ConversationSummary,
  DirectMessage,
  ReactionSummary,
  JobChatCandidate,
} from './types';

/** Thrown on any non-2xx API response; carries the status and parsed body. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API request failed (${status})`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/** Typed client for the CCG Connect API (api/routes/*). Grows with the backend. */
export const api = {
  me: () => request<{ principal: Principal; profile: UserProfile | null }>('/api/me'),
  admin: {
    users: () => request<UserProfile[]>('/api/admin/users'),
    setRole: (id: string, role: UserProfile['role']) =>
      request<UserProfile>(`/api/admin/users/${encodeURIComponent(id)}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    createStaff: (data: {
      email: string;
      password: string;
      first_name?: string;
      last_name?: string;
      role: 'ops_admin' | 'owner';
    }) => request<UserProfile>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  },
  jobs: {
    list: () => request<{ jobs: Job[] }>('/api/jobs'),
    get: (id: string) => request<{ job: Job }>(`/api/jobs/${encodeURIComponent(id)}`),
    create: (data: Partial<Job>) =>
      request<{ job: Job }>('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Job>) =>
      request<{ job: Job }>(`/api/jobs/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  assignments: {
    list: () => request<{ assignments: JobAssignment[] }>('/api/assignments'),
    create: (data: { job_id: string; contractor_id: string; agreed_rate_type?: string; agreed_rate?: number; planned_start?: string; planned_finish?: string }) =>
      request<{ assignment: JobAssignment }>('/api/assignments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  onboarding: {
    submit: (data: {
      role: 'contractor' | 'client' | 'staff';
      first_name?: string;
      last_name?: string;
      display_name?: string;
      email?: string;
      phone?: string;
      preferred_contact_method?: 'phone' | 'email' | 'sms' | 'whatsapp';
      terms_accepted?: boolean;
      privacy_accepted?: boolean;
      /** Required only for the staff path — the server-held invite code. */
      staff_code?: string;
      address?: { line_1?: string; line_2?: string; town_city?: string; county?: string; postcode?: string };
      contractor?: Record<string, unknown>;
      client?: Record<string, unknown>;
    }) => request<{ profile: UserProfile }>('/api/onboarding', { method: 'POST', body: JSON.stringify(data) }),
  },
  profiles: {
    get: (userId: string) =>
      request<{ profile: UserProfile }>(`/api/profiles/${encodeURIComponent(userId)}`),
    update: (userId: string, data: Partial<UserProfile>) =>
      request<{ profile: UserProfile }>(`/api/profiles/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    photoUrl: (userId: string) => `/api/profiles/${encodeURIComponent(userId)}/photo`,
    uploadPhoto: async (userId: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/profiles/${encodeURIComponent(userId)}/photo`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body);
      return body as { profile_photo_url: string };
    },
  },
  contractors: {
    list: () => request<{ contractors: Contractor[] }>('/api/contractors'),
    create: (data: Partial<Contractor>) =>
      request<{ contractor: Contractor }>('/api/contractors', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request<{ contractor: Contractor }>(`/api/contractors/${encodeURIComponent(id)}`),
    update: (id: string, data: Partial<Contractor>) =>
      request<{ contractor: Contractor }>(`/api/contractors/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  clients: {
    list: () => request<{ clients: Client[] }>('/api/clients'),
    get: (id: string) => request<{ client: Client }>(`/api/clients/${encodeURIComponent(id)}`),
    create: (data: Partial<Client> & { individual_or_company_name: string }) =>
      request<{ client: Client }>('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Client>) =>
      request<{ client: Client }>(`/api/clients/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  leads: {
    list: () => request<{ leads: Lead[] }>('/api/leads'),
    create: (data: Partial<Lead> & { consent: boolean }) =>
      request<{ ok: true; id: string }>('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { status: Lead['status'] }) =>
      request<{ lead: Lead }>(`/api/leads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  match: {
    forJob: (jobId: string) =>
      request<{
        job_id: string;
        job: { title: string; site_postcode: string | null; latitude: number | null; longitude: number | null };
        matches: MatchCandidate[];
      }>(`/api/match/${encodeURIComponent(jobId)}`),
    geocodeBackfill: () =>
      request<{ contractorsGeocoded: number; jobsGeocoded: number; more: boolean }>(
        '/api/match/geocode-backfill',
        { method: 'POST', body: JSON.stringify({}) },
      ),
  },
  timesheets: {
    list: () => request<{ timesheets: Timesheet[] }>('/api/timesheets'),
    submit: (data: {
      job_id: string;
      week_start: string;
      entries: {
        work_date: string;
        start_time: string;
        finish_time: string;
        break_minutes?: number;
        rate?: number;
        description?: string;
      }[];
    }) => request<{ timesheet: Timesheet }>('/api/timesheets', { method: 'POST', body: JSON.stringify(data) }),
    review: (id: string, data: { status: string; rejection_reason?: string }) =>
      request<{ timesheet: Timesheet }>(`/api/timesheets/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  credentials: {
    types: () => request<{ credentialTypes: CredentialType[] }>('/api/credentials/types'),
    list: (contractorId?: string) =>
      request<{ credentials: ContractorCredential[] }>(
        `/api/credentials${contractorId ? `?contractor_id=${encodeURIComponent(contractorId)}` : ''}`,
      ),
    awaiting: () => request<{ credentials: ContractorCredential[] }>('/api/credentials/awaiting'),
    create: (data: Partial<ContractorCredential> & { credential_type_id: string }) =>
      request<{ credential: ContractorCredential }>('/api/credentials', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<ContractorCredential>) =>
      request<{ credential: ContractorCredential }>(`/api/credentials/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    fileUrl: (id: string) => `/api/credentials/${encodeURIComponent(id)}/file`,
    uploadFile: async (id: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/credentials/${encodeURIComponent(id)}/file`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body);
      return body as { credential: ContractorCredential };
    },
  },
  notifications: {
    list: () => request<{ notifications: AppNotification[] }>('/api/notifications'),
    markRead: (id: string) =>
      request<{ notification: AppNotification }>(`/api/notifications/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
  },
  media: {
    list: (jobId: string) =>
      request<{ media: JobMediaItem[] }>(`/api/media?job_id=${encodeURIComponent(jobId)}`),
    fileUrl: (id: string) => `/api/media/${encodeURIComponent(id)}/file`,
    upload: async (jobId: string, file: File, fields: Record<string, string> = {}) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('job_id', jobId);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body);
      return body as { media: JobMediaItem };
    },
  },
  deploymentMedia: {
    list: (deploymentId: string) =>
      request<{ media: DeploymentMediaItem[] }>(`/api/deployment-media?deployment_id=${encodeURIComponent(deploymentId)}`),
    upload: async (deploymentId: string, file: File, fields: Record<string, string> = {}) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('deployment_id', deploymentId);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      const res = await fetch('/api/deployment-media', { method: 'POST', credentials: 'include', body: fd });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body);
      return body as { media: DeploymentMediaItem };
    },
  },
  messages: {
    contacts: () => request<{ contacts: MessagingContact[] }>('/api/messages/contacts'),
    conversations: () =>
      request<{ conversations: ConversationSummary[] }>('/api/messages/conversations'),
    startConversation: (userId: string) =>
      request<{ conversation: { id: string; other: MessagingContact } }>(
        '/api/messages/conversations',
        { method: 'POST', body: JSON.stringify({ user_id: userId }) },
      ),
    setPrefs: (conversationId: string, prefs: { pinned?: boolean; muted?: boolean }) =>
      request<{ id: string; pinned: boolean; muted: boolean }>(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/prefs`,
        { method: 'PATCH', body: JSON.stringify(prefs) },
      ),
    jobCandidates: () => request<{ jobs: JobChatCandidate[] }>('/api/messages/job-candidates'),
    openJobConversation: (jobId: string) =>
      request<{ conversation: { id: string; kind: 'job'; title: string; job_id: string } }>(
        `/api/messages/conversations/job/${encodeURIComponent(jobId)}`,
        { method: 'POST', body: JSON.stringify({}) },
      ),
    listMessages: (conversationId: string) =>
      request<{ messages: DirectMessage[] }>(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
      ),
    send: (conversationId: string, body: string, replyToId?: string) =>
      request<{ message: DirectMessage }>(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
        { method: 'POST', body: JSON.stringify({ body, reply_to_id: replyToId }) },
      ),
    sendAttachment: async (conversationId: string, file: File, body?: string, replyToId?: string) => {
      const fd = new FormData();
      fd.append('file', file);
      if (body) fd.append('body', body);
      if (replyToId) fd.append('reply_to_id', replyToId);
      const res = await fetch(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/attachment`,
        { method: 'POST', credentials: 'include', body: fd },
      );
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data);
      return data as { message: DirectMessage };
    },
    react: (conversationId: string, messageId: string, emoji: string) =>
      request<{ messageId: string; reactions: ReactionSummary[] }>(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reactions`,
        { method: 'POST', body: JSON.stringify({ emoji }) },
      ),
  },
  quotes: {
    list: (jobId?: string) =>
      request<{ quotes: Quote[] }>(`/api/quotes${jobId ? `?job_id=${encodeURIComponent(jobId)}` : ''}`),
    create: (data: {
      job_id?: string;
      client_id?: string;
      quote_number?: string;
      recipient_name?: string;
      line_items: { description?: string; qty?: number; unitPrice?: number }[];
      vat_rate?: number;
      valid_until?: string;
      notes?: string;
    }) => request<{ quote: Quote }>('/api/quotes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { status?: string; notes?: string }) =>
      request<{ quote: Quote }>(`/api/quotes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  commercial: {
    accounts: {
      list: () => request<{ accounts: CorporateAccount[] }>('/api/commercial/accounts'),
      get: (id: string) => request<{ account: CorporateAccount }>(`/api/commercial/accounts/${encodeURIComponent(id)}`),
      create: (data: Partial<CorporateAccount> & { legal_name: string }) =>
        request<{ account: CorporateAccount }>('/api/commercial/accounts', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<CorporateAccount>) =>
        request<{ account: CorporateAccount }>(`/api/commercial/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
    contacts: {
      list: (accountId: string) =>
        request<{ contacts: CorporateContact[] }>(`/api/commercial/contacts?account_id=${encodeURIComponent(accountId)}`),
      create: (data: Partial<CorporateContact> & { account_id: string; name: string }) =>
        request<{ contact: CorporateContact }>('/api/commercial/contacts', { method: 'POST', body: JSON.stringify(data) }),
    },
    rateCards: {
      list: (accountId: string) =>
        request<{ rate_cards: RateCard[] }>(`/api/commercial/rate-cards?account_id=${encodeURIComponent(accountId)}`),
      create: (data: Partial<RateCard> & { account_id: string; trade: string }) =>
        request<{ rate_card: RateCard }>('/api/commercial/rate-cards', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<RateCard>) =>
        request<{ rate_card: RateCard }>(`/api/commercial/rate-cards/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
    surcharges: {
      list: (accountId: string) =>
        request<{ surcharges: SurchargeRule[] }>(`/api/commercial/surcharges?account_id=${encodeURIComponent(accountId)}`),
      create: (data: { account_id: string; label: string; kind?: 'percent' | 'fixed'; value?: number }) =>
        request<{ surcharge: SurchargeRule }>('/api/commercial/surcharges', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<SurchargeRule>) =>
        request<{ surcharge: SurchargeRule }>(`/api/commercial/surcharges/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
    projects: {
      list: (accountId?: string) =>
        request<{ projects: CommercialProject[] }>(`/api/commercial/projects${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`),
      get: (id: string) => request<{ project: CommercialProject }>(`/api/commercial/projects/${encodeURIComponent(id)}`),
      create: (data: Partial<CommercialProject> & { account_id: string; name: string }) =>
        request<{ project: CommercialProject }>('/api/commercial/projects', { method: 'POST', body: JSON.stringify(data) }),
    },
    sites: {
      list: (projectId: string) =>
        request<{ sites: CommercialSite[] }>(`/api/commercial/sites?project_id=${encodeURIComponent(projectId)}`),
      get: (id: string) => request<{ site: CommercialSite }>(`/api/commercial/sites/${encodeURIComponent(id)}`),
      create: (data: Partial<CommercialSite> & { project_id: string; name: string }) =>
        request<{ site: CommercialSite }>('/api/commercial/sites', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<CommercialSite>) =>
        request<{ site: CommercialSite }>(`/api/commercial/sites/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
    accountUsers: {
      list: (accountId: string) =>
        request<{ users: CorporateAccountUser[] }>(`/api/commercial/accounts/${encodeURIComponent(accountId)}/users`),
      link: (accountId: string, userId: string) =>
        request<{ link: CorporateAccountUser }>(`/api/commercial/accounts/${encodeURIComponent(accountId)}/users`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
      unlink: (accountId: string, userId: string) =>
        request<{ ok: boolean }>(`/api/commercial/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
    },
  },
  portal: {
    commercial: (accountId?: string) =>
      request<PortalCommercial>(`/api/portal/commercial${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`),
    worker: () => request<WorkerPortal>('/api/portal/worker'),
    updateAvailability: (data: { available_from?: string | null; availability_note?: string | null }) =>
      request<{ available_from: string | null; availability_note: string | null }>('/api/portal/worker/availability', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  forms: {
    templates: {
      list: (type?: FormType) =>
        request<{ templates: FormTemplate[] }>(`/api/forms/templates${type ? `?type=${encodeURIComponent(type)}` : ''}`),
      get: (id: string) => request<{ template: FormTemplate }>(`/api/forms/templates/${encodeURIComponent(id)}`),
      create: (data: { name: string; form_type: FormType; description?: string; content?: RamsContent }) =>
        request<{ template: FormTemplate }>('/api/forms/templates', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<{ name: string; description: string | null; content: RamsContent; active: boolean }>) =>
        request<{ template: FormTemplate }>(`/api/forms/templates/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
    documents: {
      list: (deploymentId?: string) =>
        request<{ documents: FormDocument[] }>(`/api/forms/documents${deploymentId ? `?deployment_id=${encodeURIComponent(deploymentId)}` : ''}`),
      get: (id: string) => request<{ document: FormDocument }>(`/api/forms/documents/${encodeURIComponent(id)}`),
      create: (data: { title: string; form_type?: FormType; template_id?: string; deployment_id?: string; reference?: string; site_name?: string; prepared_by?: string; content?: RamsContent }) =>
        request<{ document: FormDocument }>('/api/forms/documents', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<{ title: string; reference: string | null; site_name: string | null; prepared_by: string | null; content: RamsContent; status: string }>) =>
        request<{ document: FormDocument }>(`/api/forms/documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
      issue: (id: string) =>
        request<{ document: FormDocument }>(`/api/forms/documents/${encodeURIComponent(id)}/issue`, { method: 'POST', body: JSON.stringify({}) }),
    },
  },
  workers: {
    list: (contractorId?: string) =>
      request<{ workers: Worker[] }>(`/api/workers${contractorId ? `?contractor_id=${encodeURIComponent(contractorId)}` : ''}`),
    get: (id: string) => request<{ worker: Worker }>(`/api/workers/${encodeURIComponent(id)}`),
    create: (data: Partial<Worker> & { full_name: string }) =>
      request<{ worker: Worker }>('/api/workers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Worker>) =>
      request<{ worker: Worker }>(`/api/workers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    cards: {
      list: (workerId: string) =>
        request<{ cards: WorkerCard[] }>(`/api/workers/${encodeURIComponent(workerId)}/cards`),
      create: (workerId: string, data: Partial<WorkerCard> & { card_type: string }) =>
        request<{ card: WorkerCard }>(`/api/workers/${encodeURIComponent(workerId)}/cards`, { method: 'POST', body: JSON.stringify(data) }),
      update: (workerId: string, cardId: string, data: Partial<WorkerCard>) =>
        request<{ card: WorkerCard }>(`/api/workers/${encodeURIComponent(workerId)}/cards/${encodeURIComponent(cardId)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
  },
  gangs: {
    list: () => request<{ gangs: Gang[] }>('/api/gangs'),
    get: (id: string) => request<{ gang: Gang; members: GangMember[] }>(`/api/gangs/${encodeURIComponent(id)}`),
    create: (data: Partial<Gang> & { name: string }) =>
      request<{ gang: Gang }>('/api/gangs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Gang>) =>
      request<{ gang: Gang }>(`/api/gangs/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    addMember: (gangId: string, data: { worker_id: string; role?: 'leader' | 'permanent' | 'reserve' }) =>
      request<{ member: GangMember }>(`/api/gangs/${encodeURIComponent(gangId)}/members`, { method: 'POST', body: JSON.stringify(data) }),
    removeMember: (gangId: string, memberId: string) =>
      request<{ ok: true }>(`/api/gangs/${encodeURIComponent(gangId)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' }),
    candidates: (gangId: string, requirements: string) =>
      request<{ requirements: string[]; candidates: ReplacementCandidate[] }>(`/api/gangs/${encodeURIComponent(gangId)}/candidates?requirements=${encodeURIComponent(requirements)}`),
  },
  labourRequests: {
    list: (accountId?: string) =>
      request<{ requests: LabourRequest[] }>(`/api/labour-requests${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`),
    get: (id: string) => request<{ request: LabourRequest }>(`/api/labour-requests/${encodeURIComponent(id)}`),
    create: (data: Partial<LabourRequest> & { account_id: string; title: string }) =>
      request<{ request: LabourRequest }>('/api/labour-requests', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<LabourRequest>) =>
      request<{ request: LabourRequest }>(`/api/labour-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  deployments: {
    list: (labourRequestId?: string) =>
      request<{ deployments: Deployment[] }>(`/api/deployments${labourRequestId ? `?labour_request_id=${encodeURIComponent(labourRequestId)}` : ''}`),
    get: (id: string) =>
      request<{ deployment: Deployment; request: LabourRequest | null; requirements: string[]; members: DeploymentMember[]; compliance: ComplianceCell[] }>(
        `/api/deployments/${encodeURIComponent(id)}`,
      ),
    create: (data: { labour_request_id: string; gang_id?: string; worker_ids?: string[]; start_date?: string; finish_date?: string; notes?: string }) =>
      request<{ deployment: Deployment }>('/api/deployments', { method: 'POST', body: JSON.stringify(data) }),
    confirm: (id: string) =>
      request<{ deployment: Deployment; conversation_id: string | null }>(`/api/deployments/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: JSON.stringify({}) }),
    update: (id: string, data: { status?: string; notes?: string }) =>
      request<{ deployment: Deployment }>(`/api/deployments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    attendance: {
      list: (deploymentId: string, date?: string) =>
        request<{ attendance: AttendanceRecord[] }>(`/api/deployments/${encodeURIComponent(deploymentId)}/attendance${date ? `?date=${encodeURIComponent(date)}` : ''}`),
      set: (deploymentId: string, data: { worker_id: string; date: string; status: string; replacement_needed?: boolean; reason?: string; check_in_time?: string }) =>
        request<{ record: AttendanceRecord }>(`/api/deployments/${encodeURIComponent(deploymentId)}/attendance`, { method: 'POST', body: JSON.stringify(data) }),
    },
    checkin: {
      context: (deploymentId: string) =>
        request<CheckinContext>(`/api/deployments/${encodeURIComponent(deploymentId)}/checkin`),
      record: (
        deploymentId: string,
        data: { check_type: 'arrival' | 'departure'; worker_id?: string; latitude?: number; longitude?: number; accuracy_m?: number },
      ) => request<{ record: AttendanceRecord }>(`/api/deployments/${encodeURIComponent(deploymentId)}/checkin`, { method: 'POST', body: JSON.stringify(data) }),
    },
    diary: {
      list: (deploymentId: string) =>
        request<{ entries: SiteDiaryEntry[] }>(`/api/deployments/${encodeURIComponent(deploymentId)}/diary`),
      create: (deploymentId: string, data: Partial<SiteDiaryEntry> & { date: string }) =>
        request<{ entry: SiteDiaryEntry }>(`/api/deployments/${encodeURIComponent(deploymentId)}/diary`, { method: 'POST', body: JSON.stringify(data) }),
    },
    replacements: {
      candidates: (deploymentId: string) =>
        request<{ requirements: string[]; candidates: ReplacementCandidate[] }>(`/api/deployments/${encodeURIComponent(deploymentId)}/replacement-candidates`),
      list: (deploymentId: string) =>
        request<{ replacements: DeploymentReplacement[] }>(`/api/deployments/${encodeURIComponent(deploymentId)}/replacements`),
      create: (deploymentId: string, data: { original_worker_id: string; replacement_worker_id: string; reason?: string }) =>
        request<{ replacement: DeploymentReplacement }>(`/api/deployments/${encodeURIComponent(deploymentId)}/replacements`, { method: 'POST', body: JSON.stringify(data) }),
    },
  },
  incidents: {
    list: () => request<{ incidents: Incident[] }>('/api/incidents'),
    get: (id: string) => request<{ incident: Incident }>(`/api/incidents/${encodeURIComponent(id)}`),
    create: (data: Partial<Incident> & { type: string }) =>
      request<{ incident: Incident }>('/api/incidents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Incident>) =>
      request<{ incident: Incident }>(`/api/incidents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  kids: {
    list: (deploymentId: string) =>
      request<{ kids: KidDocument[] }>(`/api/kids?deployment_id=${encodeURIComponent(deploymentId)}`),
    get: (id: string) => request<{ kid: KidDocument }>(`/api/kids/${encodeURIComponent(id)}`),
    create: (data: { deployment_id: string; worker_id: string }) =>
      request<{ kid: KidDocument }>('/api/kids', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<KidDocument>) =>
      request<{ kid: KidDocument }>(`/api/kids/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    acknowledge: (id: string, signature: string) =>
      request<{ kid: KidDocument }>(`/api/kids/${encodeURIComponent(id)}/acknowledge`, { method: 'POST', body: JSON.stringify({ signature }) }),
  },
  performance: {
    list: (params: { deploymentId?: string; workerId?: string }) => {
      const q = params.deploymentId ? `deployment_id=${encodeURIComponent(params.deploymentId)}` : `worker_id=${encodeURIComponent(params.workerId ?? '')}`;
      return request<{ reviews: PerformanceReview[] }>(`/api/performance?${q}`);
    },
    summary: (workerId: string) =>
      request<WorkerPerformanceSummary>(`/api/performance/worker/${encodeURIComponent(workerId)}/summary`),
    create: (data: {
      deployment_id: string; worker_id: string; direction: 'client_on_worker' | 'worker_on_site';
      scores: Record<string, number>; would_repeat?: boolean; comment?: string; evidence?: string;
    }) => request<{ review: PerformanceReview }>('/api/performance', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { status?: string; comment?: string }) =>
      request<{ review: PerformanceReview }>(`/api/performance/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  materials: {
    list: (deploymentId: string) =>
      request<{ materials: DeploymentMaterial[]; rollup: MaterialRollup }>(`/api/materials?deployment_id=${encodeURIComponent(deploymentId)}`),
    create: (data: Partial<DeploymentMaterial> & { deployment_id: string; name: string }) =>
      request<{ material: DeploymentMaterial }>('/api/materials', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<DeploymentMaterial>) =>
      request<{ material: DeploymentMaterial }>(`/api/materials/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      request<{ ok: true }>(`/api/materials/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  dashboard: {
    commercial: (months?: number) =>
      request<CommercialDashboard>(`/api/dashboard/commercial${months ? `?months=${encodeURIComponent(months)}` : ''}`),
  },
  commercialTimesheets: {
    list: (deploymentId?: string) =>
      request<{ timesheets: CommercialTimesheet[] }>(`/api/commercial-timesheets${deploymentId ? `?deployment_id=${encodeURIComponent(deploymentId)}` : ''}`),
    create: (data: { deployment_id: string; worker_id: string; week_start: string; basic_hours?: number; overtime_hours?: number; pay_rate?: number; charge_rate?: number; oncost_rate?: number; travel?: number; lodge?: number; expenses?: number; deductions?: number }) =>
      request<{ timesheet: CommercialTimesheet }>('/api/commercial-timesheets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<{ timesheet: CommercialTimesheet }>(`/api/commercial-timesheets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  commercialInvoices: {
    list: (deploymentId?: string) =>
      request<{ invoices: CommercialInvoice[] }>(`/api/commercial-invoices${deploymentId ? `?deployment_id=${encodeURIComponent(deploymentId)}` : ''}`),
    generate: (deploymentId: string, vatRate?: number) =>
      request<{ invoice: CommercialInvoice }>('/api/commercial-invoices/generate', { method: 'POST', body: JSON.stringify({ deployment_id: deploymentId, vat_rate: vatRate }) }),
    update: (id: string, data: { status?: string; notes?: string }) =>
      request<{ invoice: CommercialInvoice }>(`/api/commercial-invoices/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  checkins: {
    list: (jobId: string) =>
      request<{ checkins: JobCheckin[] }>(`/api/checkins?job_id=${encodeURIComponent(jobId)}`),
    create: (data: {
      job_id: string;
      check_type: 'arrival' | 'departure';
      latitude?: number;
      longitude?: number;
      accuracy_m?: number;
      note?: string;
    }) => request<{ checkin: JobCheckin }>('/api/checkins', { method: 'POST', body: JSON.stringify(data) }),
  },
  signatures: {
    request: (jobId: string) =>
      request<{ configured: boolean; id?: string }>('/api/signatures/request', {
        method: 'POST',
        body: JSON.stringify({ job_id: jobId }),
      }),
  },
  invoices: {
    list: () => request<{ invoices: Invoice[] }>('/api/invoices'),
    create: (data: Partial<Invoice> & { job_id: string; net_amount: number }) =>
      request<{ invoice: Invoice }>('/api/invoices', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Invoice>) =>
      request<{ invoice: Invoice }>(`/api/invoices/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
};
