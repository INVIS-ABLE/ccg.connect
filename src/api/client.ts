import type {
  Job,
  JobAssignment,
  UserProfile,
  Principal,
  Contractor,
  Lead,
  Timesheet,
  Invoice,
  MatchCandidate,
  AppNotification,
  JobMediaItem,
  CredentialType,
  ContractorCredential,
  MessagingContact,
  ConversationSummary,
  DirectMessage,
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
  profiles: {
    get: (userId: string) =>
      request<{ profile: UserProfile }>(`/api/profiles/${encodeURIComponent(userId)}`),
    update: (userId: string, data: Partial<UserProfile>) =>
      request<{ profile: UserProfile }>(`/api/profiles/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
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
      request<{ job_id: string; matches: MatchCandidate[] }>(`/api/match/${encodeURIComponent(jobId)}`),
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
  messages: {
    contacts: () => request<{ contacts: MessagingContact[] }>('/api/messages/contacts'),
    conversations: () =>
      request<{ conversations: ConversationSummary[] }>('/api/messages/conversations'),
    startConversation: (userId: string) =>
      request<{ conversation: { id: string; other: MessagingContact } }>(
        '/api/messages/conversations',
        { method: 'POST', body: JSON.stringify({ user_id: userId }) },
      ),
    listMessages: (conversationId: string) =>
      request<{ messages: DirectMessage[] }>(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
      ),
    send: (conversationId: string, body: string) =>
      request<{ message: DirectMessage }>(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
        { method: 'POST', body: JSON.stringify({ body }) },
      ),
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
