import type { AuthEnv } from './auth';
import type { Principal } from '../src/domain/permissions/permissions';

/** Worker bindings (D1, secrets, static assets, the Base44 proxy target). */
export type Bindings = AuthEnv & {
  ASSETS: Fetcher;
  BASE44_APP_BASE_URL?: string;
};

/** Per-request context set by middleware. */
export type Variables = {
  principal: Principal;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
