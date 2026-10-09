import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { resolveWordOfState } from './commentProjection';
import { fixRunOf, fixRunTitle, fixRunWordOf, type FixRunSource } from './fixRun';
import type { ReviewCommentState } from './reviewCommentState';

const attempt = ({
  id,
  agentId,
  launchId,
  createdAt,
  model = 'claude-sonnet-5-5',
  effort = 'medium',
}: {
  readonly id: string;
  readonly agentId: string;
  readonly launchId: string;
  readonly createdAt: number;
  readonly model?: string;
  readonly effort?: string | null;
}): ResolveAttempt => ({
  id,
  sessionId: 'session-1' as SessionId,
  agentId: agentId as AgentId,
  prNumber: 318,
  threadIds: [],
  launchId,
  provider: 'anthropic',
  model,
  effort,
  instructions: null,
  phase: 'running',
  mountTarget: null,
  startedAt: createdAt,
  endedAt: null,
  error: null,
  createdAt,
  batchId: null,
  copyPath: null,
  launchChoice: null,
});

const FIRST = attempt({ id: 'a1', agentId: 'agent-1', launchId: 'launch-1', createdAt: 10 });
const SECOND = attempt({ id: 'a2', agentId: 'agent-2', launchId: 'launch-2', createdAt: 20 });

const source = (
  threadId: string,
  state: ReviewCommentState,
  from: ResolveAttempt | null,
): FixRunSource => ({ threadId, word: resolveWordOfState({ state }), attempt: from });

describe('fixRunOf', () => {
  it('is null when no comment belongs to a fix run', () => {
    expect(
      fixRunOf({ sources: [source('t1', 'new', null), source('t2', 'pushed', null)] }),
    ).toBeNull();
  });

  it('counts the comments of the launch by the delivery words', () => {
    const run = fixRunOf({
      sources: [
        source('t1', 'ready', FIRST),
        source('t2', 'edited', FIRST),
        source('t3', 'needs', FIRST),
        source('t4', 'drafting', FIRST),
        source('t5', 'failed', FIRST),
        source('t6', 'accepted', FIRST),
      ],
    });

    expect(run?.total).toBe(6);
    expect(run?.tally).toMatchObject({
      needsYou: 4,
      toReview: 2,
      question: 1,
      couldntFix: 1,
      working: 1,
      readyToPush: 1,
      done: 0,
    });
    expect(run?.isLive).toBe(true);
    expect(run?.agentId).toBe('agent-1');
    expect(run?.threadIds).toEqual(['t1', 't2', 't3', 't4', 't5', 't6']);
  });

  it('shows the newest launch when two exist', () => {
    const run = fixRunOf({
      sources: [source('t1', 'ready', FIRST), source('t2', 'drafting', SECOND)],
    });

    expect(run?.launchId).toBe('launch-2');
    expect(run?.total).toBe(1);
  });

  it('keeps the run once nothing works but a decision or a failure is left', () => {
    const run = fixRunOf({
      sources: [source('t1', 'ready', FIRST), source('t2', 'failed', FIRST)],
    });

    expect(run?.isLive).toBe(false);
  });

  it('drops the run once every comment is pushed or skipped', () => {
    expect(
      fixRunOf({ sources: [source('t1', 'pushed', FIRST), source('t2', 'skipped', FIRST)] }),
    ).toBeNull();
  });

  it('keeps the run while accepted comments wait for the push', () => {
    const run = fixRunOf({
      sources: [source('t1', 'accepted', FIRST), source('t2', 'skipped', FIRST)],
    });

    expect(run?.tally).toMatchObject({ readyToPush: 1, leftOpen: 1 });
  });

  it('names the model with its effort', () => {
    const run = fixRunOf({ sources: [source('t1', 'drafting', FIRST)] });

    expect(run?.model).toBe('Sonnet 5.5 · Medium');
  });
});

describe('fixRunTitle', () => {
  it('says Fixing while the run works and Fix run once it waits on you', () => {
    const live = fixRunOf({
      sources: [source('t1', 'drafting', FIRST), source('t2', 'ready', FIRST)],
    });
    const idle = fixRunOf({ sources: [source('t1', 'ready', FIRST)] });

    expect(live === null ? '' : fixRunTitle({ run: live })).toBe('Fixing 2 comments');
    expect(idle === null ? '' : fixRunTitle({ run: idle })).toBe('Fix run · 1 comment');
  });
});

describe('fixRunWordOf', () => {
  it('names the run by the question first, then what works, then what needs you, then what waits', () => {
    expect(fixRunWordOf({ words: ['ready', 'working', 'to_review', 'question'] })).toBe('question');
    expect(fixRunWordOf({ words: ['ready', 'working', 'push_failed'] })).toBe('working');
    expect(fixRunWordOf({ words: ['ready', 'push_failed', 'to_review'] })).toBe('push_failed');
    expect(fixRunWordOf({ words: ['ready', 'couldnt_fix'] })).toBe('couldnt_fix');
    expect(fixRunWordOf({ words: ['ready', 'working'] })).toBe('working');
    expect(fixRunWordOf({ words: ['done', 'ready'] })).toBe('ready');
    expect(fixRunWordOf({ words: [] })).toBe('done');
  });
});
