import type { Job, JobAssignment, UserProfile, Principal } from './types';

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
};
