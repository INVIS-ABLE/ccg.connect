import { describe, it, expect } from 'vitest';
import { isReactionEmoji, summariseReactions, REACTION_EMOJI } from './reactions';

describe('isReactionEmoji', () => {
  it('accepts members of the curated set', () => {
    for (const e of REACTION_EMOJI) expect(isReactionEmoji(e)).toBe(true);
  });
  it('rejects anything outside the set', () => {
    expect(isReactionEmoji('🦄')).toBe(false);
    expect(isReactionEmoji('not-an-emoji')).toBe(false);
    expect(isReactionEmoji('')).toBe(false);
    expect(isReactionEmoji(null)).toBe(false);
    expect(isReactionEmoji(123)).toBe(false);
  });
});

describe('summariseReactions', () => {
  it('returns an empty array when there are no rows', () => {
    expect(summariseReactions([], 'me')).toEqual([]);
  });

  it('tallies counts and flags the viewer’s own reactions', () => {
    const rows = [
      { emoji: '👍', user_id: 'me' },
      { emoji: '👍', user_id: 'them' },
      { emoji: '❤️', user_id: 'them' },
    ];
    expect(summariseReactions(rows, 'me')).toEqual([
      { emoji: '👍', count: 2, mine: true },
      { emoji: '❤️', count: 1, mine: false },
    ]);
  });

  it('mine is false when only other users reacted', () => {
    const rows = [{ emoji: '😂', user_id: 'them' }];
    expect(summariseReactions(rows, 'me')).toEqual([{ emoji: '😂', count: 1, mine: false }]);
  });

  it('orders emojis by the canonical reaction order regardless of input order', () => {
    const rows = [
      { emoji: '🙏', user_id: 'a' },
      { emoji: '👍', user_id: 'b' },
      { emoji: '😮', user_id: 'c' },
    ];
    expect(summariseReactions(rows, 'me').map((r) => r.emoji)).toEqual(['👍', '😮', '🙏']);
  });
});
