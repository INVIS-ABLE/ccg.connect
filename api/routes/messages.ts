import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import {
  conversations,
  conversationPrefs,
  directMessages,
  messageReactions,
  userProfiles,
  jobs,
  jobAssignments,
  deploymentWorkers,
  workers,
} from '../db/schema';
import { requireAuth } from '../lib/session';
import {
  canStartConversation,
  isConversationParticipant,
  canAccessJobChat,
  isAdmin,
} from '../../src/domain/permissions/permissions';
import { isAppRole } from '../../src/domain/auth/roles';
import {
  isReactionEmoji,
  summariseReactions,
  type ReactionSummary,
} from '../../src/domain/messaging/reactions';
import type { AppEnv } from '../env';

/**
 * Direct messaging (1:1 WhatsApp-style chat).
 *
 * Authorization is enforced here on every operation (invariant 9): who may talk
 * to whom is hub-and-spoke (src/domain/permissions.canStartConversation), and
 * only the two participants may read or post in a conversation. Frontend hiding
 * is never the security boundary.
 */
const route = new Hono<AppEnv>();
route.use('*', requireAuth);

type ProfileRow = typeof userProfiles.$inferSelect;

function displayName(p: Pick<ProfileRow, 'first_name' | 'last_name' | 'display_name' | 'email'>): string {
  const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return full || p.display_name || p.email || 'User';
}

function toContact(p: ProfileRow) {
  return {
    user_id: p.user_id,
    name: displayName(p),
    role: p.role,
    profile_photo_url: p.profile_photo_url,
  };
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('__');
}

type MessageRow = typeof directMessages.$inferSelect;

/** Compact snapshot of a quoted message, enough for the UI to render the bar. */
interface ReplyPreview {
  id: string;
  sender_user_id: string;
  body: string;
  attachment_type: MessageRow['attachment_type'];
}

function replyPreview(parent: MessageRow | undefined): ReplyPreview | null {
  if (!parent) return null;
  return {
    id: parent.id,
    sender_user_id: parent.sender_user_id,
    body: parent.body,
    attachment_type: parent.attachment_type,
  };
}

/** Client shape of a message (without per-recipient `mine`). Never exposes the
 *  raw R2 key — attachments are served via the authorized attachment route. */
function baseShape(
  m: MessageRow,
  extras?: { reply_to?: ReplyPreview | null; reactions?: ReactionSummary[] },
) {
  return {
    id: m.id,
    conversation_id: m.conversation_id,
    sender_user_id: m.sender_user_id,
    body: m.body,
    read_at: m.read_at,
    created_at: m.created_at,
    attachment_url: m.attachment_key ? `/api/messages/attachments/${m.id}/file` : null,
    attachment_type: m.attachment_type,
    attachment_name: m.attachment_name,
    reply_to: extras?.reply_to ?? null,
    reactions: extras?.reactions ?? [],
  };
}

interface UploadedFile {
  type: string;
  size: number;
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const ATTACHMENT_MAX = 25 * 1024 * 1024;
function classifyAttachment(mime: string): 'image' | 'audio' | 'file' | null {
  const m = mime.toLowerCase().split(';')[0]?.trim() ?? '';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  // Documents / everything else we accept as a generic file.
  if (
    m === 'application/pdf' ||
    m.startsWith('application/') ||
    m.startsWith('text/') ||
    m.startsWith('video/')
  ) {
    return 'file';
  }
  return null;
}

// GET /api/messages/contacts — people the caller is allowed to start a chat with.
route.get('/contacts', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const all = await db.select().from(userProfiles).all();
  const contacts = all
    .filter((u) => u.user_id !== me.userId)
    .filter((u) => u.account_status !== 'archived')
    .filter((u) => isAppRole(u.role) && canStartConversation(me, u.role))
    .map(toContact)
    .sort((x, y) => x.name.localeCompare(y.name));
  return c.json({ contacts });
});

// GET /api/messages/conversations — the caller's chats (direct + job rooms),
// newest activity first, each with an unread count and pin/mute state.
route.get('/conversations', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);

  // Direct chats: the caller is one of the two participants.
  const directRows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.kind, 'direct'),
        or(eq(conversations.a_user_id, me.userId), eq(conversations.b_user_id, me.userId)),
      ),
    )
    .orderBy(desc(conversations.last_message_at))
    .all();

  // Job rooms the caller belongs to: admins see all; a contractor sees rooms for
  // jobs they're actively assigned to; clients are never in job delivery rooms.
  let jobRows: (typeof conversations.$inferSelect)[] = [];
  if (isAdmin(me)) {
    jobRows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.kind, 'job'))
      .orderBy(desc(conversations.last_message_at))
      .all();
  } else if (me.role === 'contractor' && me.contractorId) {
    const myJobs = await db
      .select({ job_id: jobAssignments.job_id })
      .from(jobAssignments)
      .where(
        and(
          eq(jobAssignments.contractor_id, me.contractorId),
          eq(jobAssignments.assignment_status, 'active'),
        ),
      )
      .all();
    const jobIds = [...new Set(myJobs.map((j) => j.job_id))];
    if (jobIds.length) {
      jobRows = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.kind, 'job'), inArray(conversations.job_id, jobIds)))
        .all();
    }
  }

  // Site rooms (deployment chats): admins see all; a worker sees rooms for
  // deployments they're on (matched via their app login).
  let siteRows: (typeof conversations.$inferSelect)[] = [];
  if (isAdmin(me)) {
    siteRows = await db.select().from(conversations).where(eq(conversations.kind, 'site')).all();
  } else {
    const myWorker = await db.select({ id: workers.id }).from(workers).where(eq(workers.user_id, me.userId)).all();
    const myWorkerIds = myWorker.map((w) => w.id);
    if (myWorkerIds.length) {
      const dws = await db
        .select({ deployment_id: deploymentWorkers.deployment_id })
        .from(deploymentWorkers)
        .where(inArray(deploymentWorkers.worker_id, myWorkerIds))
        .all();
      const depIds = [...new Set(dws.map((d) => d.deployment_id))];
      if (depIds.length) {
        siteRows = await db
          .select()
          .from(conversations)
          .where(and(eq(conversations.kind, 'site'), inArray(conversations.deployment_id, depIds)))
          .all();
      }
    }
  }

  const rows = [...directRows, ...jobRows, ...siteRows];
  if (rows.length === 0) return c.json({ conversations: [] });
  const ids = rows.map((r) => r.id);

  // My private pin/mute prefs for these conversations (one row per conversation).
  const prefRows = await db
    .select()
    .from(conversationPrefs)
    .where(
      and(eq(conversationPrefs.user_id, me.userId), inArray(conversationPrefs.conversation_id, ids)),
    )
    .all();
  const prefByConv = new Map(prefRows.map((p) => [p.conversation_id, p]));

  // Profiles for the "other" participant of each direct chat.
  const otherIds = directRows
    .map((r) => (r.a_user_id === me.userId ? r.b_user_id : r.a_user_id))
    .filter((x): x is string => !!x);
  const profiles = otherIds.length
    ? await db.select().from(userProfiles).where(inArray(userProfiles.user_id, otherIds)).all()
    : [];
  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

  // One query for all my unread messages, tallied per conversation.
  const unreadByConv = new Map<string, number>();
  const unread = await db
    .select({ cid: directMessages.conversation_id })
    .from(directMessages)
    .where(
      and(
        inArray(directMessages.conversation_id, ids),
        ne(directMessages.sender_user_id, me.userId),
        isNull(directMessages.read_at),
      ),
    )
    .all();
  for (const u of unread) unreadByConv.set(u.cid, (unreadByConv.get(u.cid) ?? 0) + 1);

  const conversationsOut = rows.map((r) => {
    const pref = prefByConv.get(r.id);
    const base = {
      id: r.id,
      kind: r.kind,
      last_message_at: r.last_message_at,
      last_message_preview: r.last_message_preview,
      unread: unreadByConv.get(r.id) ?? 0,
      pinned: pref?.pinned ?? false,
      muted: pref?.muted ?? false,
    };
    if (r.kind === 'job' || r.kind === 'site') {
      const fallback = r.kind === 'site' ? 'Site chat' : 'Job chat';
      return { ...base, title: r.title ?? fallback, job_id: r.job_id, other: null };
    }
    const otherId = r.a_user_id === me.userId ? r.b_user_id : r.a_user_id;
    const other = otherId ? profileByUser.get(otherId) : undefined;
    return {
      ...base,
      title: null,
      job_id: null,
      other: other
        ? toContact(other)
        : { user_id: otherId ?? '', name: 'User', role: null, profile_photo_url: null },
    };
  });

  // Pinned first, then newest activity within each group.
  conversationsOut.sort((a, b) => {
    if (Number(b.pinned) !== Number(a.pinned)) return Number(b.pinned) - Number(a.pinned);
    return (b.last_message_at || '').localeCompare(a.last_message_at || '');
  });

  return c.json({ conversations: conversationsOut });
});

/** Build a job room's display title from the job. */
function jobChatTitle(job: { job_reference: string | null; title: string }): string {
  return job.job_reference ? `${job.job_reference} · ${job.title}` : job.title;
}

// GET /api/messages/job-candidates — jobs the caller may open a team chat for
// (admins: jobs with an active delivery team; contractors: their assigned jobs).
route.get('/job-candidates', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);

  let jobIds: string[];
  if (isAdmin(me)) {
    const active = await db
      .select({ job_id: jobAssignments.job_id })
      .from(jobAssignments)
      .where(eq(jobAssignments.assignment_status, 'active'))
      .all();
    jobIds = [...new Set(active.map((r) => r.job_id))];
  } else if (me.role === 'contractor' && me.contractorId) {
    const mine = await db
      .select({ job_id: jobAssignments.job_id })
      .from(jobAssignments)
      .where(
        and(
          eq(jobAssignments.contractor_id, me.contractorId),
          eq(jobAssignments.assignment_status, 'active'),
        ),
      )
      .all();
    jobIds = [...new Set(mine.map((r) => r.job_id))];
  } else {
    jobIds = [];
  }

  if (jobIds.length === 0) return c.json({ jobs: [] });

  const jobRows = await db.select().from(jobs).where(inArray(jobs.id, jobIds)).all();
  const convoRows = await db
    .select({ id: conversations.id, job_id: conversations.job_id })
    .from(conversations)
    .where(and(eq(conversations.kind, 'job'), inArray(conversations.job_id, jobIds)))
    .all();
  const convoByJob = new Map(convoRows.map((r) => [r.job_id, r.id]));

  const out = jobRows
    .map((j) => ({
      job_id: j.id,
      title: jobChatTitle(j),
      job_reference: j.job_reference,
      conversation_id: convoByJob.get(j.id) ?? null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return c.json({ jobs: out });
});

// POST /api/messages/conversations/job/:jobId — get-or-create the job's team room.
// Membership-checked: only the ops team and assigned contractors may open it.
route.post('/conversations/job/:jobId', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const jobId = c.req.param('jobId');

  const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!job) return c.json({ error: 'job_not_found' }, 404);

  const assigned = await assignedContractorIds(db, jobId);
  if (!canAccessJobChat(me, { assignedContractorIds: assigned })) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const key = `job:${jobId}`;
  const title = jobChatTitle(job);
  const existing = (
    await db.select().from(conversations).where(eq(conversations.pair_key, key)).limit(1)
  )[0];
  if (existing) {
    return c.json({
      conversation: { id: existing.id, kind: 'job', title: existing.title ?? title, job_id: jobId },
    });
  }

  const created = (
    await db
      .insert(conversations)
      .values({ kind: 'job', pair_key: key, job_id: jobId, title })
      .returning()
  )[0];
  if (!created) return c.json({ error: 'create_failed' }, 500);
  return c.json({ conversation: { id: created.id, kind: 'job', title, job_id: jobId } }, 201);
});

// PATCH /api/messages/conversations/:id/prefs — set this user's private pin/mute
// state for a conversation (upsert). Body: { pinned?, muted? }.
route.patch('/conversations/:id/prefs', async (c) => {
  const loaded = await loadOwnedConversation(c);
  if ('error' in loaded) return loaded.error;
  const { convo, db, me } = loaded;

  const body = (await c.req.json().catch(() => null)) as
    | { pinned?: boolean; muted?: boolean }
    | null;
  if (!body || (body.pinned === undefined && body.muted === undefined)) {
    return c.json({ error: 'nothing_to_update' }, 400);
  }

  const existing = (
    await db
      .select()
      .from(conversationPrefs)
      .where(
        and(
          eq(conversationPrefs.conversation_id, convo.id),
          eq(conversationPrefs.user_id, me.userId),
        ),
      )
      .limit(1)
  )[0];

  if (existing) {
    await db
      .update(conversationPrefs)
      .set({
        ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
        ...(body.muted !== undefined ? { muted: body.muted } : {}),
        updated_at: new Date(),
      })
      .where(eq(conversationPrefs.id, existing.id));
  } else {
    await db.insert(conversationPrefs).values({
      conversation_id: convo.id,
      user_id: me.userId,
      pinned: body.pinned ?? false,
      muted: body.muted ?? false,
    });
  }

  return c.json({
    id: convo.id,
    pinned: body.pinned ?? existing?.pinned ?? false,
    muted: body.muted ?? existing?.muted ?? false,
  });
});

// POST /api/messages/conversations — find or create a 1:1 conversation with a user.
route.post('/conversations', async (c) => {
  const me = c.get('principal');
  const body = (await c.req.json().catch(() => null)) as { user_id?: string } | null;
  const targetId = body?.user_id?.trim();
  if (!targetId) return c.json({ error: 'user_id_required' }, 400);
  if (targetId === me.userId) return c.json({ error: 'cannot_message_self' }, 400);

  const db = drizzle(c.env.DB);
  const target = (
    await db.select().from(userProfiles).where(eq(userProfiles.user_id, targetId)).limit(1)
  )[0];
  if (!target || !isAppRole(target.role)) return c.json({ error: 'user_not_found' }, 404);

  // Authorization: hub-and-spoke (invariants 1 & 2).
  if (!canStartConversation(me, target.role)) return c.json({ error: 'forbidden' }, 403);

  const key = pairKey(me.userId, targetId);
  const existing = (
    await db.select().from(conversations).where(eq(conversations.pair_key, key)).limit(1)
  )[0];
  if (existing) {
    return c.json({ conversation: { id: existing.id, other: toContact(target) } });
  }

  // Deterministic participant order (matches pairKey) so a_user_id/b_user_id are
  // stable and definitely strings.
  const a = me.userId < targetId ? me.userId : targetId;
  const b = me.userId < targetId ? targetId : me.userId;
  const created = (
    await db.insert(conversations).values({ pair_key: key, a_user_id: a, b_user_id: b }).returning()
  )[0];
  if (!created) return c.json({ error: 'create_failed' }, 500);
  return c.json({ conversation: { id: created.id, other: toContact(target) } }, 201);
});

/** Active-assignment contractor ids for a job (the contractor side of a job chat). */
async function assignedContractorIds(db: ReturnType<typeof drizzle>, jobId: string): Promise<string[]> {
  const rows = await db
    .select({ contractor_id: jobAssignments.contractor_id })
    .from(jobAssignments)
    .where(and(eq(jobAssignments.job_id, jobId), eq(jobAssignments.assignment_status, 'active')))
    .all();
  return rows.map((r) => r.contractor_id);
}

/** The app-login user ids of a deployment's workers (the site-chat membership). */
async function deploymentMemberUserIds(db: ReturnType<typeof drizzle>, deploymentId: string): Promise<string[]> {
  const dws = await db
    .select({ worker_id: deploymentWorkers.worker_id })
    .from(deploymentWorkers)
    .where(eq(deploymentWorkers.deployment_id, deploymentId))
    .all();
  const ids = dws.map((d) => d.worker_id);
  if (ids.length === 0) return [];
  const ws = await db.select({ user_id: workers.user_id }).from(workers).where(inArray(workers.id, ids)).all();
  return ws.map((w) => w.user_id).filter((x): x is string => !!x);
}

/** Whether the caller may read/post in a conversation (direct / job / site room). */
async function mayAccessConversation(
  db: ReturnType<typeof drizzle>,
  me: { userId: string; role: string; contractorId: string | null },
  convo: typeof conversations.$inferSelect,
): Promise<boolean> {
  if (convo.kind === 'job') {
    if (!convo.job_id) return false;
    const assigned = await assignedContractorIds(db, convo.job_id);
    return canAccessJobChat(me as never, { assignedContractorIds: assigned });
  }
  if (convo.kind === 'site') {
    // Ops team + the deployed workers (who have a login).
    if (isAdmin(me as never)) return true;
    if (!convo.deployment_id) return false;
    const members = await deploymentMemberUserIds(db, convo.deployment_id);
    return members.includes(me.userId);
  }
  return isConversationParticipant(me as never, convo);
}

// Load a conversation the caller participates in, or return the HTTP error.
async function loadOwnedConversation(c: Context<AppEnv>) {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  if (!id) return { error: c.json({ error: 'not_found' }, 404) } as const;
  const convo = (
    await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  )[0];
  if (!convo) return { error: c.json({ error: 'not_found' }, 404) } as const;
  if (!(await mayAccessConversation(db, me, convo)))
    return { error: c.json({ error: 'forbidden' }, 403) } as const;
  return { convo, db, me } as const;
}

// GET /api/messages/conversations/:id/messages — messages oldest→newest. Marks
// the other party's messages as read for the caller.
route.get('/conversations/:id/messages', async (c) => {
  const loaded = await loadOwnedConversation(c);
  if ('error' in loaded) return loaded.error;
  const { convo, db, me } = loaded;

  const msgs = await db
    .select()
    .from(directMessages)
    .where(eq(directMessages.conversation_id, convo.id))
    .orderBy(asc(directMessages.created_at))
    .all();

  // Reply previews resolve against messages already in this list (a reply always
  // quotes an earlier message in the same conversation) — no extra query needed.
  const byId = new Map(msgs.map((m) => [m.id, m]));

  // One query for every reaction in the conversation, grouped per message.
  const reactionRows = await db
    .select({ message_id: messageReactions.message_id, emoji: messageReactions.emoji, user_id: messageReactions.user_id })
    .from(messageReactions)
    .where(eq(messageReactions.conversation_id, convo.id))
    .all();
  const reactionsByMsg = new Map<string, { emoji: string; user_id: string }[]>();
  for (const r of reactionRows) {
    const arr = reactionsByMsg.get(r.message_id) ?? [];
    arr.push({ emoji: r.emoji, user_id: r.user_id });
    reactionsByMsg.set(r.message_id, arr);
  }

  // Job rooms have many participants, so the UI needs each message's sender.
  // (Direct chats don't — it's just me vs the other person.)
  let senderById = new Map<string, ProfileRow>();
  if (convo.kind === 'job' || convo.kind === 'site') {
    const senderIds = [...new Set(msgs.map((m) => m.sender_user_id))];
    if (senderIds.length) {
      const sp = await db
        .select()
        .from(userProfiles)
        .where(inArray(userProfiles.user_id, senderIds))
        .all();
      senderById = new Map(sp.map((p) => [p.user_id, p]));
    }
  }

  // Mark incoming messages read (drives unread badges for the other endpoints).
  await db
    .update(directMessages)
    .set({ read_at: new Date().toISOString() })
    .where(
      and(
        eq(directMessages.conversation_id, convo.id),
        ne(directMessages.sender_user_id, me.userId),
        isNull(directMessages.read_at),
      ),
    );

  return c.json({
    messages: msgs.map((m) => {
      const sp = convo.kind === 'job' || convo.kind === 'site' ? senderById.get(m.sender_user_id) : undefined;
      return {
        ...baseShape(m, {
          reply_to: m.reply_to_id ? replyPreview(byId.get(m.reply_to_id)) : null,
          reactions: summariseReactions(reactionsByMsg.get(m.id) ?? [], me.userId),
        }),
        mine: m.sender_user_id === me.userId,
        sender: sp ? toContact(sp) : null,
      };
    }),
  });
});

/**
 * Resolve an optional reply target. Returns the parent row, `null` when no reply
 * was requested, or the sentinel `'invalid'` when the id is missing/foreign to
 * this conversation (caller maps that to a 400).
 */
async function resolveReplyParent(
  db: ReturnType<typeof drizzle>,
  conversationId: string,
  replyToId: string | undefined,
): Promise<MessageRow | null | 'invalid'> {
  const id = replyToId?.trim();
  if (!id) return null;
  const parent = (
    await db.select().from(directMessages).where(eq(directMessages.id, id)).limit(1)
  )[0];
  if (!parent || parent.conversation_id !== conversationId) return 'invalid';
  return parent;
}

/** Persist last-message metadata + fan out a new message to the room. */
async function afterSend(
  c: Context<AppEnv>,
  convoId: string,
  created: MessageRow,
  preview: string,
  reply_to: ReplyPreview | null = null,
) {
  await drizzle(c.env.DB)
    .update(conversations)
    .set({ last_message_at: created.created_at instanceof Date ? created.created_at.toISOString() : new Date().toISOString(), last_message_preview: preview.slice(0, 140), updated_at: new Date() })
    .where(eq(conversations.id, convoId));
  try {
    const stub = c.env.CHAT_ROOMS.get(c.env.CHAT_ROOMS.idFromName(convoId));
    c.executionCtx.waitUntil(
      stub.fetch('https://chat/broadcast', {
        method: 'POST',
        body: JSON.stringify({ type: 'message', message: baseShape(created, { reply_to }) }),
      }),
    );
  } catch {
    /* realtime is an enhancement over polling */
  }
}

// POST /api/messages/conversations/:id/messages — send a message.
route.post('/conversations/:id/messages', async (c) => {
  const loaded = await loadOwnedConversation(c);
  if ('error' in loaded) return loaded.error;
  const { convo, db, me } = loaded;

  const body = (await c.req.json().catch(() => null)) as
    | { body?: string; reply_to_id?: string }
    | null;
  const text = body?.body?.trim();
  if (!text) return c.json({ error: 'empty_message' }, 400);
  if (text.length > 4000) return c.json({ error: 'message_too_long' }, 400);

  // Validate any quoted message belongs to THIS conversation (invariants 1 & 2 —
  // never let a reply leak the existence/content of another conversation).
  const parent = await resolveReplyParent(db, convo.id, body?.reply_to_id);
  if (parent === 'invalid') return c.json({ error: 'invalid_reply_target' }, 400);

  const created = (
    await db
      .insert(directMessages)
      .values({
        conversation_id: convo.id,
        sender_user_id: me.userId,
        body: text,
        reply_to_id: parent?.id ?? null,
      })
      .returning()
  )[0];
  if (!created) return c.json({ error: 'send_failed' }, 500);

  const reply_to = replyPreview(parent ?? undefined);
  await afterSend(c, convo.id, created, text, reply_to);
  return c.json({ message: { ...baseShape(created, { reply_to }), mine: true } }, 201);
});

// POST /api/messages/conversations/:id/attachment — send an image / file / voice
// note (multipart). Optional `body` becomes the caption.
route.post('/conversations/:id/attachment', async (c) => {
  const loaded = await loadOwnedConversation(c);
  if ('error' in loaded) return loaded.error;
  const { convo, db, me } = loaded;

  const form = await c.req.formData().catch(() => null);
  const fileEntry = form?.get('file');
  if (fileEntry == null || typeof fileEntry === 'string') return c.json({ error: 'file_required' }, 400);
  const file = fileEntry as unknown as UploadedFile;
  if (file.size <= 0 || file.size > ATTACHMENT_MAX) return c.json({ error: 'bad_size' }, 400);
  const kind = classifyAttachment(file.type);
  if (!kind) return c.json({ error: 'unsupported_type' }, 400);

  const caption = typeof form?.get('body') === 'string' ? (form.get('body') as string).trim() : '';
  const replyToId = typeof form?.get('reply_to_id') === 'string' ? (form.get('reply_to_id') as string) : undefined;
  const parent = await resolveReplyParent(db, convo.id, replyToId);
  if (parent === 'invalid') return c.json({ error: 'invalid_reply_target' }, 400);

  const key = `chat/${convo.id}/${crypto.randomUUID()}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  const created = (
    await db
      .insert(directMessages)
      .values({
        conversation_id: convo.id,
        sender_user_id: me.userId,
        body: caption,
        attachment_key: key,
        attachment_type: kind,
        attachment_name: file.name,
        attachment_mime: file.type,
        reply_to_id: parent?.id ?? null,
      })
      .returning()
  )[0];
  if (!created) return c.json({ error: 'send_failed' }, 500);

  const reply_to = replyPreview(parent ?? undefined);
  const preview = caption || (kind === 'image' ? '📷 Photo' : kind === 'audio' ? '🎤 Voice note' : '📎 File');
  await afterSend(c, convo.id, created, preview, reply_to);
  return c.json({ message: { ...baseShape(created, { reply_to }), mine: true } }, 201);
});

// POST /api/messages/conversations/:id/messages/:messageId/reactions — toggle an
// emoji reaction on a message. Body: { emoji }. Returns the message's updated
// reaction summary for the caller and broadcasts a delta to the room.
route.post('/conversations/:id/messages/:messageId/reactions', async (c) => {
  const loaded = await loadOwnedConversation(c);
  if ('error' in loaded) return loaded.error;
  const { convo, db, me } = loaded;

  const body = (await c.req.json().catch(() => null)) as { emoji?: string } | null;
  const emoji = body?.emoji;
  if (!isReactionEmoji(emoji)) return c.json({ error: 'invalid_emoji' }, 400);

  const messageId = c.req.param('messageId');
  const msg = (
    await db.select().from(directMessages).where(eq(directMessages.id, messageId)).limit(1)
  )[0];
  if (!msg || msg.conversation_id !== convo.id) return c.json({ error: 'not_found' }, 404);

  // Toggle: remove the caller's existing identical reaction, otherwise add it.
  const existing = (
    await db
      .select({ id: messageReactions.id })
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.message_id, messageId),
          eq(messageReactions.user_id, me.userId),
          eq(messageReactions.emoji, emoji),
        ),
      )
      .limit(1)
  )[0];

  let action: 'add' | 'remove';
  if (existing) {
    await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
    action = 'remove';
  } else {
    await db.insert(messageReactions).values({
      message_id: messageId,
      conversation_id: convo.id,
      user_id: me.userId,
      emoji,
    });
    action = 'add';
  }

  // Recompute this message's summary for the caller.
  const rows = await db
    .select({ emoji: messageReactions.emoji, user_id: messageReactions.user_id })
    .from(messageReactions)
    .where(eq(messageReactions.message_id, messageId))
    .all();
  const reactions = summariseReactions(rows, me.userId);

  // Broadcast a viewer-agnostic delta; each client recomputes its own `mine`.
  try {
    const stub = c.env.CHAT_ROOMS.get(c.env.CHAT_ROOMS.idFromName(convo.id));
    c.executionCtx.waitUntil(
      stub.fetch('https://chat/broadcast', {
        method: 'POST',
        body: JSON.stringify({ type: 'reaction', messageId, emoji, userId: me.userId, action }),
      }),
    );
  } catch {
    /* realtime is an enhancement over polling */
  }

  return c.json({ messageId, reactions });
});

// GET /api/messages/attachments/:messageId/file — stream an attachment to a
// participant of its conversation.
route.get('/attachments/:messageId/file', async (c) => {
  const me = c.get('principal');
  const db = drizzle(c.env.DB);
  const msg = (
    await db.select().from(directMessages).where(eq(directMessages.id, c.req.param('messageId'))).limit(1)
  )[0];
  if (!msg || !msg.attachment_key) return c.json({ error: 'not_found' }, 404);
  const convo = (
    await db.select().from(conversations).where(eq(conversations.id, msg.conversation_id)).limit(1)
  )[0];
  if (!convo || !isConversationParticipant(me, convo)) return c.json({ error: 'forbidden' }, 403);

  const object = await c.env.MEDIA.get(msg.attachment_key);
  if (!object) return c.json({ error: 'file_missing' }, 404);
  return new Response(object.body, {
    headers: {
      'content-type': msg.attachment_mime ?? object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'private, max-age=3600',
    },
  });
});

// GET /api/messages/conversations/:id/ws — realtime channel for a conversation.
// Authorized here (participant check), then handed to the conversation's DO.
route.get('/conversations/:id/ws', async (c) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
    return c.json({ error: 'expected_websocket' }, 426);
  }
  const loaded = await loadOwnedConversation(c);
  if ('error' in loaded) return loaded.error;
  const { convo, me } = loaded;

  const stub = c.env.CHAT_ROOMS.get(c.env.CHAT_ROOMS.idFromName(convo.id));
  const headers = new Headers(c.req.raw.headers);
  headers.set('x-user-id', me.userId);
  return stub.fetch(new Request(c.req.raw.url, { method: 'GET', headers }));
});

export default route;
