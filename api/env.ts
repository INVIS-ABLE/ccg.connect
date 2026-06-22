import type { AuthEnv } from './auth';
import type { Principal } from '../src/domain/permissions/permissions';

/** Worker bindings (D1, secrets, static assets, media bucket). */
export type Bindings = AuthEnv & {
  ASSETS: Fetcher;
  MEDIA: R2Bucket;
};

/** Per-request context set by middleware. */
export type Variables = {
  principal: Principal;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
