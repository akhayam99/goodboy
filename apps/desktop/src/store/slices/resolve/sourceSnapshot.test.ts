import { describe, expect, it } from 'vitest';
import type { PrComment, ResolveSourceSnapshot } from '@goodboy/types';
import { nextSourceSnapshot, sourceTextOf } from './sourceSnapshot';

const comment = (over: Partial<PrComment>): PrComment => ({
  id: 'c1',
  author: 'mquint',
  authorAvatarUrl: null,
  body: 'Move the timeout to config.',
  createdAt: '2026-09-29T10:00:00Z',
  url: 'https://example.test/c1',
  source: 'review',
  threadId: 'T1',
  ...over,
});

const baseline: ResolveSourceSnapshot = {
  body: 'Move the timeout to config.',
  author: 'mquint',
  fingerprint: 'fp1',
  seenAt: 1,
  replyIds: [],
  changed: null,
};

const source = ({ comments }: { readonly comments: ReadonlyArray<PrComment> }) => {
  const text = sourceTextOf({ comments, threadId: 'T1' });
  if (text === null) {
    throw new Error('no text');
  }
  return text;
};

describe('sourceTextOf', () => {
  it('is the root comment and lists the replies apart', () => {
    const thread = source({
      comments: [
        comment({}),
        comment({
          id: 'c2',
          author: 'tvarga',
          body: 'Agreed.',
          createdAt: '2026-09-29T10:05:00Z',
        }),
      ],
    });
    expect(thread.body).toBe('Move the timeout to config.');
    expect(thread.author).toBe('mquint');
    expect(thread.replyIds).toEqual(['c2']);
  });

  it('is null for a thread with no comments', () => {
    expect(sourceTextOf({ comments: [comment({})], threadId: 'other' })).toBeNull();
  });
});

describe('nextSourceSnapshot', () => {
  it('records the first sighting as the baseline', () => {
    const next = nextSourceSnapshot({
      previous: null,
      stage: 'proposed',
      fingerprint: 'fp1',
      source: source({ comments: [comment({})] }),
      now: 5,
    });
    expect(next).toEqual({ ...baseline, seenAt: 5 });
  });

  it('writes nothing when the comment is the same as the baseline', () => {
    expect(
      nextSourceSnapshot({
        previous: baseline,
        stage: 'proposed',
        fingerprint: 'fp1',
        source: source({ comments: [comment({})] }),
        now: 9,
      }),
    ).toBeNull();
  });

  it('marks a real edit as changed and names who wrote the new text', () => {
    const next = nextSourceSnapshot({
      previous: baseline,
      stage: 'proposed',
      fingerprint: 'fp2',
      source: source({
        comments: [comment({ body: 'Move the timeout to config and cap the backoff.' })],
      }),
      now: 9,
    });
    expect(next?.body).toBe(baseline.body);
    expect(next?.changed).toEqual({
      body: 'Move the timeout to config and cap the backoff.',
      author: 'mquint',
      fingerprint: 'fp2',
      seenAt: 9,
    });
  });

  it('does not touch the snapshot for a new reply, the root fingerprint is the same', () => {
    expect(
      nextSourceSnapshot({
        previous: baseline,
        stage: 'proposed',
        fingerprint: 'fp1',
        source: source({
          comments: [
            comment({}),
            comment({
              id: 'c2',
              author: 'tvarga',
              body: 'Thanks!',
              createdAt: '2026-09-29T10:05:00Z',
            }),
          ],
        }),
        now: 9,
      }),
    ).toBeNull();
  });

  it('does not rewrite a change it already saw', () => {
    const changed: ResolveSourceSnapshot = {
      ...baseline,
      changed: { body: 'New', author: 'mquint', fingerprint: 'fp2', seenAt: 8 },
    };
    expect(
      nextSourceSnapshot({
        previous: changed,
        stage: 'proposed',
        fingerprint: 'fp2',
        source: source({ comments: [comment({ body: 'New' })] }),
        now: 9,
      }),
    ).toBeNull();
  });

  it('clears the change when the comment goes back to the baseline', () => {
    const changed: ResolveSourceSnapshot = {
      ...baseline,
      changed: { body: 'New', author: 'mquint', fingerprint: 'fp2', seenAt: 8 },
    };
    const next = nextSourceSnapshot({
      previous: changed,
      stage: 'proposed',
      fingerprint: 'fp1',
      source: source({ comments: [comment({})] }),
      now: 9,
    });
    expect(next?.changed).toBeNull();
  });

  it('follows the comment silently while no draft exists yet', () => {
    const next = nextSourceSnapshot({
      previous: baseline,
      stage: 'new',
      fingerprint: 'fp2',
      source: source({ comments: [comment({ body: 'Rewritten.' })] }),
      now: 9,
    });
    expect(next).toMatchObject({ body: 'Rewritten.', fingerprint: 'fp2', changed: null });
  });
});
