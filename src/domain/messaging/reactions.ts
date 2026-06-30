/**
 * Reaction vocabulary for direct messages.
 *
 * A fixed, curated set (WhatsApp-style) rather than free-form emoji input: it
 * keeps the picker dependency-free, makes server-side validation trivial, and
 * bounds what can be stored. Shared by the API (validation) and the React UI
 * (the reaction bar) so the two never drift.
 */
export const REACTION_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === 'string' && (REACTION_EMOJI as readonly string[]).includes(value);
}

/** A reaction tally for one emoji on a message, from a given viewer's perspective. */
export interface ReactionSummary {
  emoji: string;
  count: number;
  /** Whether the requesting user has applied this emoji. */
  mine: boolean;
}

/**
 * Roll raw reaction rows up into per-emoji summaries for `viewerUserId`, ordered
 * by the canonical {@link REACTION_EMOJI} order so the UI is stable.
 */
export function summariseReactions(
  rows: readonly { emoji: string; user_id: string }[],
  viewerUserId: string,
): ReactionSummary[] {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of rows) {
    const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.user_id === viewerUserId) cur.mine = true;
    byEmoji.set(r.emoji, cur);
  }
  const order = (e: string) => {
    const i = (REACTION_EMOJI as readonly string[]).indexOf(e);
    return i === -1 ? REACTION_EMOJI.length : i;
  };
  return [...byEmoji.entries()]
    .map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }))
    .sort((a, b) => order(a.emoji) - order(b.emoji));
}
