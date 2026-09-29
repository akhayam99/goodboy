import { describe, expect, it } from 'vitest';
import { resolverTurnOutcomes } from './resolverTurnOutcomes';

const THREAD_ID = 'PRRT_kwDO123';

describe('resolverTurnOutcomes', () => {
  it('attaches a same-turn reply to the outcome it rode in with', () => {
    const { outcomes, markerCount } = resolverTurnOutcomes({
      assistantText: [
        `<<comment-resolved threadId="${THREAD_ID}" commitSha="abc1234">>`,
        `<<comment-reply id="${THREAD_ID}">>done as asked<</comment-reply>>`,
      ].join('\n'),
      previousOutcomes: {},
    });

    expect(outcomes[THREAD_ID]).toEqual({
      kind: 'resolved',
      commitSha: 'abc1234',
      reply: 'done as asked',
    });
    expect(markerCount).toBe(1);
  });

  it('rewrites the reply of a previously settled thread on a reply-only turn', () => {
    const { outcomes, markerCount } = resolverTurnOutcomes({
      assistantText: `<<comment-reply id="${THREAD_ID}">>the reworked reply<</comment-reply>>`,
      previousOutcomes: {
        [THREAD_ID]: { kind: 'resolved', commitSha: 'abc1234', reply: 'the first draft' },
      },
    });

    expect(outcomes[THREAD_ID]).toEqual({
      kind: 'resolved',
      commitSha: 'abc1234',
      reply: 'the reworked reply',
    });
    expect(markerCount).toBe(1);
  });

  it('keeps the previous verdict kind when only the reply is reworked', () => {
    const { outcomes } = resolverTurnOutcomes({
      assistantText: `<<comment-reply id="${THREAD_ID}">>softer wording<</comment-reply>>`,
      previousOutcomes: {
        [THREAD_ID]: { kind: 'wontfix', reason: 'by design', reply: 'blunt wording' },
      },
    });

    expect(outcomes[THREAD_ID]).toEqual({
      kind: 'wontfix',
      reason: 'by design',
      reply: 'softer wording',
    });
  });

  it('drops a reply that has no outcome anywhere to attach to', () => {
    const { outcomes, markerCount } = resolverTurnOutcomes({
      assistantText: `<<comment-reply id="${THREAD_ID}">>orphan<</comment-reply>>`,
      previousOutcomes: {},
    });

    expect(outcomes[THREAD_ID]).toBeUndefined();
    expect(markerCount).toBe(0);
  });

  it.each([
    ['no reply block', ''],
    ['a blank reply block', `\n<<comment-reply id="${THREAD_ID}">>   <</comment-reply>>`],
    ['a reply cut off before its close', `\n<<comment-reply id="${THREAD_ID}">>half a sentence`],
  ])('keeps the commit as a resolved outcome with %s', (_label, tail) => {
    const { turnOutcomes, markerCount } = resolverTurnOutcomes({
      assistantText: `Committed a8c81d9.\n<<comment-resolved threadId="${THREAD_ID}" commitSha="a8c81d9">>${tail}`,
      previousOutcomes: {},
    });

    expect(turnOutcomes[THREAD_ID]).toMatchObject({ kind: 'resolved', commitSha: 'a8c81d9' });
    expect(markerCount).toBeGreaterThan(0);
  });

  it('leaves untouched threads alone on a reply-only turn', () => {
    const other = 'PRRT_kwDO456';
    const { outcomes } = resolverTurnOutcomes({
      assistantText: `<<comment-reply id="${THREAD_ID}">>new reply<</comment-reply>>`,
      previousOutcomes: {
        [THREAD_ID]: { kind: 'resolved', commitSha: 'abc1234', reply: 'old' },
        [other]: { kind: 'analyzed', reply: 'analysis' },
      },
    });

    expect(outcomes[other]).toEqual({ kind: 'analyzed', reply: 'analysis' });
  });
});
