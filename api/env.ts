import type { AuthEnv } from './auth';
import type { Principal } from '../src/domain/permissions/permissions';

/** Worker bindings (D1, secrets, static assets, media bucket, chat rooms). */
export type Bindings = AuthEnv & {
  ASSETS: Fetcher;
  MEDIA: R2Bucket;
  /** Durable Object namespace backing realtime chat (one room per conversation). */
  CHAT_ROOMS: DurableObjectNamespace;
};

/** Per-request context set by middleware. */
export type Variables = {
  principal: Principal;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
