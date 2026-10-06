// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Session, SessionId, SessionStage, WorkspaceId } from '@goodboy/types';
import type { SessionGithubState } from './types';
import { deriveSessionStage } from './slices/session-view/deriveSessionStage';
import { sortAndGroupSessions as groupWith } from './slices/session-view/sortAndGroupSessions';
import type { GroupedSessions } from './slices/session-view/types';
import type { SessionViewPrefs } from '@goodboy/types';
import { DEFAULT_PREFS, STAGE_ORDER } from './slices/session-view/types';

type OrderPrefs = Pick<SessionViewPrefs, 'sort' | 'group'>;

const sortAndGroupSessions = (
  sessions: ReadonlyArray<Session>,
  prefs: OrderPrefs,
  githubState: Readonly<Record<SessionId, SessionGithubState>>,
  stageBySession: Readonly<Record<SessionId, SessionStage>> = {},
): ReadonlyArray<GroupedSessions> =>
  groupWith({ sessions, prefs: { ...DEFAULT_PREFS, ...prefs }, githubState, stageBySession });

function sid(n: number): SessionId {
  return `session-${n}` as SessionId;
}

const WS = 'ws-1' as WorkspaceId;

function makeSession(
  id: SessionId,
  overrides: Partial<{
    goal: string;
    createdAt: string;
    updatedAt: string;
  }> = {},
): Session {
  return {
    id,
    workspaceId: WS,
    goal: overrides.goal ?? 'default goal',
    state: { kind: 'idle', lastActivityAt: '2024-01-01T00:00:00.000Z' as Session['createdAt'] },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: false,
    createdAt: (overrides.createdAt ?? '2024-01-01T00:00:00.000Z') as Session['createdAt'],
    updatedAt: (overrides.updatedAt ?? '2024-01-01T00:00:00.000Z') as Session['updatedAt'],
  };
}

function makePr(
  overrides: Partial<{
    state: 'draft' | 'open' | 'approved' | 'queued' | 'merged' | 'closed';
    isDraft: boolean;
    reviewDecision: 'approved' | 'changes_requested' | 'review_required' | null;
  }> = {},
): NonNullable<SessionGithubState['pr']> {
  return {
    number: 1,
    title: 'test pr',
    url: 'https://github.com/x/y/pull/1',
    state: overrides.state ?? 'open',
    mergeable: null,
    checks: null,
    baseBranch: 'main',
    headBranch: 'feat/x',
    isDraft: overrides.isDraft ?? false,
    reviewDecision: overrides.reviewDecision ?? null,
    body: '',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function githubWith(
  entries: Array<{ id: SessionId; pr: SessionGithubState['pr'] }>,
): Readonly<Record<SessionId, SessionGithubState>> {
  const result: Record<SessionId, SessionGithubState> = {};
  for (const e of entries) {
    result[e.id] = {
      pr: e.pr,
      linkedIssues: [],
      fetchedAt: null,
      failedAt: null,
      loading: false,
      error: null,
      detail: null,
      detailFetchedAt: null,
      detailLoading: false,
      detailError: null,
    };
  }
  return result;
}

function keys(groups: ReadonlyArray<GroupedSessions>): string[] {
  return groups.map((g) => g.key);
}

function flatIds(groups: ReadonlyArray<GroupedSessions>): SessionId[] {
  return groups.flatMap((g) => g.sessions.map((s) => s.id));
}

describe('sortAndGroupSessions, updatedAt sort', () => {
  const s1 = makeSession(sid(1), {
    updatedAt: '2024-01-03T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
  });
  const s2 = makeSession(sid(2), {
    updatedAt: '2024-01-05T00:00:00.000Z',
    createdAt: '2024-01-02T00:00:00.000Z',
  });
  const s3 = makeSession(sid(3), {
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-03T00:00:00.000Z',
  });
  const prefs: OrderPrefs = { sort: 'updatedAt', group: 'none' };

  it('orders newest-updated first', () => {
    const result = sortAndGroupSessions([s1, s3, s2], prefs, {});
    expect(flatIds(result)).toEqual([sid(2), sid(1), sid(3)]);
  });

  it('returns single group keyed "all"', () => {
    const result = sortAndGroupSessions([s1], prefs, {});
    expect(keys(result)).toEqual(['all']);
  });

  it('tie-breaks by createdAt desc', () => {
    const a = makeSession(sid(10), {
      updatedAt: '2024-01-02T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    const b = makeSession(sid(11), {
      updatedAt: '2024-01-02T00:00:00.000Z',
      createdAt: '2024-01-03T00:00:00.000Z',
    });
    const result = sortAndGroupSessions([a, b], prefs, {});
    expect(flatIds(result)).toEqual([sid(11), sid(10)]);
  });

  it('empty input → single empty group', () => {
    const result = sortAndGroupSessions([], prefs, {});
    expect(result).toHaveLength(1);
    expect(result[0]!.sessions).toHaveLength(0);
  });
});

describe('sortAndGroupSessions, goal sort', () => {
  const prefs: OrderPrefs = { sort: 'goal', group: 'none' };

  it('orders A→Z case-insensitively', () => {
    const a = makeSession(sid(1), { goal: 'Zebra' });
    const b = makeSession(sid(2), { goal: 'apple' });
    const c = makeSession(sid(3), { goal: 'mango' });
    const result = sortAndGroupSessions([a, c, b], prefs, {});
    expect(flatIds(result)).toEqual([sid(2), sid(3), sid(1)]);
  });

  it('tie-breaks by updatedAt desc', () => {
    const a = makeSession(sid(1), { goal: 'same', updatedAt: '2024-01-01T00:00:00.000Z' });
    const b = makeSession(sid(2), { goal: 'same', updatedAt: '2024-01-03T00:00:00.000Z' });
    const result = sortAndGroupSessions([a, b], prefs, {});
    expect(flatIds(result)).toEqual([sid(2), sid(1)]);
  });
});

describe('sortAndGroupSessions, createdAt sort', () => {
  const prefs: OrderPrefs = { sort: 'createdAt', group: 'none' };

  it('orders newest created first', () => {
    const a = makeSession(sid(1), { createdAt: '2024-01-03T00:00:00.000Z' });
    const b = makeSession(sid(2), { createdAt: '2024-01-01T00:00:00.000Z' });
    const c = makeSession(sid(3), { createdAt: '2024-01-02T00:00:00.000Z' });
    const result = sortAndGroupSessions([a, b, c], prefs, {});
    expect(flatIds(result)).toEqual([sid(1), sid(3), sid(2)]);
  });

  it('tie-breaks by id asc', () => {
    const a = makeSession(sid(10), { createdAt: '2024-01-01T00:00:00.000Z' });
    const b = makeSession(sid(9), { createdAt: '2024-01-01T00:00:00.000Z' });
    const result = sortAndGroupSessions([a, b], prefs, {});
    expect(flatIds(result)[0]).toBe(sid(10));
    expect(flatIds(result)[1]).toBe(sid(9));
  });
});

describe('sortAndGroupSessions, stage grouping', () => {
  const prefs: OrderPrefs = { sort: 'updatedAt', group: 'stage' };

  it('produces groups in attention→running→review→building→done order, needs you first', () => {
    const sessions = [sid(1), sid(2), sid(3), sid(4), sid(5)].map((id) => makeSession(id));
    const result = sortAndGroupSessions(
      sessions,
      prefs,
      {},
      {
        [sid(1)]: 'done',
        [sid(2)]: 'building',
        [sid(3)]: 'review',
        [sid(4)]: 'running',
        [sid(5)]: 'attention',
      },
    );
    expect(keys(result)).toEqual(['attention', 'running', 'review', 'building', 'done']);
  });

  it('omits empty buckets', () => {
    const result = sortAndGroupSessions(
      [makeSession(sid(1)), makeSession(sid(2))],
      prefs,
      {},
      {
        [sid(1)]: 'attention',
        [sid(2)]: 'done',
      },
    );
    expect(keys(result)).toEqual(['attention', 'done']);
  });

  it('sessions within group are sorted', () => {
    const a = makeSession(sid(1), { updatedAt: '2024-01-01T00:00:00.000Z' });
    const b = makeSession(sid(2), { updatedAt: '2024-01-05T00:00:00.000Z' });
    const result = sortAndGroupSessions(
      [a, b],
      prefs,
      {},
      {
        [sid(1)]: 'running',
        [sid(2)]: 'running',
      },
    );
    expect(result[0]!.sessions.map((s) => s.id)).toEqual([sid(2), sid(1)]);
  });

  it('missing stage falls back to building', () => {
    const result = sortAndGroupSessions([makeSession(sid(1))], prefs, {}, {});
    expect(keys(result)).toEqual(['building']);
  });
});

describe('deriveSessionStage', () => {
  const base = (id: number) => makeSession(sid(id));
  const signals = { hasUnread: false, openQuestionCount: 0 };

  it('error state wins over everything', () => {
    const session: Session = {
      ...base(1),
      state: { kind: 'error', message: 'boom', failedAt: '2024-01-01T00:00:00.000Z' as never },
    };
    const info = deriveSessionStage({ session, pr: makePr(), ...signals, hasUnread: true });
    expect(info.stage).toBe('attention');
    expect(info.reason).toBe('agent errored');
  });

  it('running state beats attention signals', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      ...signals,
      openQuestionCount: 2,
      hasRunningAgent: true,
    });
    expect(info.stage).toBe('running');
  });

  it('a fix run comment that needs you → attention, ahead of open questions', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: makePr(),
      ...signals,
      openQuestionCount: 2,
      fixNeedsYouCount: 1,
    });
    expect(info).toMatchObject({
      stage: 'attention',
      reason: '1 comment needs you',
      attention: 'fix-needs-you',
    });
  });

  it("a comment the fix run couldn't fix → attention", () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: makePr(),
      ...signals,
      fixCouldntFixCount: 2,
    });
    expect(info).toMatchObject({
      stage: 'attention',
      reason: "2 comments couldn't be fixed",
      attention: 'fix-couldnt-fix',
    });
  });

  it('CI failure on live PR → attention', () => {
    const pr = { ...makePr(), checks: 'failure' as const };
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({
      stage: 'attention',
      reason: 'PR #1: CI failed',
      attention: 'ci-failed',
      addsFact: true,
      prState: 'open',
    });
  });

  it('changes requested → attention', () => {
    const pr = makePr({ reviewDecision: 'changes_requested' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({
      stage: 'attention',
      reason: 'PR #1: changes requested',
      attention: 'changes-requested',
      addsFact: true,
      prState: 'open',
    });
  });

  it('open questions → attention with count', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: false,
      openQuestionCount: 3,
    });
    expect(info).toEqual({
      stage: 'attention',
      reason: '3 open questions',
      attention: 'open-question',
      addsFact: true,
      prState: null,
    });
  });

  it('approved live PR → attention, ready to merge', () => {
    const pr = makePr({ state: 'approved', reviewDecision: 'approved' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({
      stage: 'attention',
      reason: 'PR #1 approved, ready to merge',
      attention: 'pr-approved',
      addsFact: true,
      prState: 'approved',
    });
  });

  it('unread reply → attention', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: true,
      openQuestionCount: 0,
    });
    expect(info).toEqual({
      stage: 'attention',
      reason: 'unread agent reply',
      attention: 'unread-reply',
      addsFact: true,
      prState: null,
    });
  });

  it('no PR and quiet → building', () => {
    const info = deriveSessionStage({ session: base(1), pr: null, ...signals });
    expect(info).toEqual({
      stage: 'building',
      reason: 'no PR yet',
      attention: null,
      addsFact: false,
      prState: null,
    });
  });

  it('open PR and quiet → review', () => {
    const info = deriveSessionStage({ session: base(1), pr: makePr(), ...signals });
    expect(info).toEqual({
      stage: 'review',
      reason: 'PR #1 awaiting review',
      attention: null,
      addsFact: false,
      prState: 'open',
    });
  });

  it('draft PR → review with draft reason', () => {
    const pr = makePr({ isDraft: true });
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({
      stage: 'review',
      reason: 'draft PR #1',
      attention: null,
      addsFact: true,
      prState: 'open',
    });
  });

  it('unread beats merged', () => {
    const pr = makePr({ state: 'merged' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals, hasUnread: true });
    expect(info.stage).toBe('attention');
  });

  it('merged PR and quiet → done', () => {
    const pr = makePr({ state: 'merged' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({
      stage: 'done',
      reason: 'PR #1 merged',
      attention: null,
      addsFact: true,
      prState: 'merged',
    });
  });

  it('idle state + running standalone agent → running', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      ...signals,
      hasRunningAgent: true,
    });
    expect(info.stage).toBe('running');
  });

  it('error state + running agent → stays attention (error wins)', () => {
    const session: Session = {
      ...base(1),
      state: { kind: 'error', message: 'boom', failedAt: '2024-01-01T00:00:00.000Z' as never },
    };
    const info = deriveSessionStage({ session, pr: null, ...signals, hasRunningAgent: true });
    expect(info.stage).toBe('attention');
    expect(info.reason).toBe('agent errored');
  });

  it('running agent + CI failure on live PR → running (agent outranks CI attention)', () => {
    const pr = { ...makePr(), checks: 'failure' as const };
    const info = deriveSessionStage({ session: base(1), pr, ...signals, hasRunningAgent: true });
    expect(info.stage).toBe('running');
  });

  it('a live agent turn → running', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      ...signals,
      hasRunningAgent: true,
    });
    expect(info).toEqual({
      stage: 'running',
      reason: 'agent running',
      attention: null,
      addsFact: false,
      prState: null,
    });
  });

  it('running agent outranks open questions', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: false,
      openQuestionCount: 4,
      hasRunningAgent: true,
    });
    expect(info.stage).toBe('running');
  });

  it('running agent on a merged PR → running, not done', () => {
    const pr = makePr({ state: 'merged' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals, hasRunningAgent: true });
    expect(info.stage).toBe('running');
  });

  it('hasRunningAgent omitted → defaults to false (no running promotion)', () => {
    const info = deriveSessionStage({ session: base(1), pr: null, ...signals });
    expect(info.stage).toBe('building');
  });

  it('branchless sessions derive running from any active agent signal', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      ...signals,
      hasRunningAgent: true,
      isBranchless: true,
    });
    expect(info).toEqual({
      stage: 'running',
      reason: 'agent running',
      attention: null,
      addsFact: false,
      prState: null,
    });
  });

  it('branchless sessions derive attention from questions or unread replies', () => {
    const questions = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: false,
      openQuestionCount: 2,
      isBranchless: true,
    });
    const unread = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: true,
      openQuestionCount: 0,
      isBranchless: true,
    });
    expect(questions).toEqual({
      stage: 'attention',
      reason: '2 open questions',
      attention: 'open-question',
      addsFact: true,
      prState: null,
    });
    expect(unread).toEqual({
      stage: 'attention',
      reason: 'unread agent reply',
      attention: 'unread-reply',
      addsFact: true,
      prState: null,
    });
  });

  it('branchless sessions stay building when agent signals are quiet', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: makePr({ state: 'merged' }),
      ...signals,
      isBranchless: true,
    });
    expect(info).toEqual({
      stage: 'building',
      reason: 'ready for work',
      attention: null,
      addsFact: true,
      prState: 'merged',
    });
  });
});

describe('sortAndGroupSessions, pr grouping', () => {
  const prefs: OrderPrefs = { sort: 'updatedAt', group: 'pr' };

  it('no PR → not-open bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions([s], prefs, {});
    expect(keys(result)).toEqual(['not-open']);
  });

  it('pr.state=closed → closed bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ state: 'closed' }) }]),
    );
    expect(keys(result)).toEqual(['closed']);
  });

  it('pr.state=merged → merged bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ state: 'merged' }) }]),
    );
    expect(keys(result)).toEqual(['merged']);
  });

  it('pr.state=queued → queued bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ state: 'queued' }) }]),
    );
    expect(keys(result)).toEqual(['queued']);
  });

  it('pr.isDraft=true → draft bucket (before reviewDecision check)', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ isDraft: true, reviewDecision: 'approved' }) }]),
    );
    expect(keys(result)).toEqual(['draft']);
  });

  it('reviewDecision=approved + not draft → reviewed bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ isDraft: false, reviewDecision: 'approved' }) }]),
    );
    expect(keys(result)).toEqual(['reviewed']);
  });

  it('open pr, not draft, no approval → reviewable bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([
        {
          id: sid(1),
          pr: makePr({ state: 'open', isDraft: false, reviewDecision: 'review_required' }),
        },
      ]),
    );
    expect(keys(result)).toEqual(['reviewable']);
  });

  it('all 7 pr buckets present → correct order', () => {
    const sessions = [sid(1), sid(2), sid(3), sid(4), sid(5), sid(6), sid(7)].map((id) =>
      makeSession(id),
    );
    const github = githubWith([
      { id: sid(1), pr: null },
      { id: sid(2), pr: makePr({ isDraft: true }) },
      { id: sid(3), pr: makePr({ isDraft: false, reviewDecision: 'review_required' }) },
      { id: sid(4), pr: makePr({ isDraft: false, reviewDecision: 'approved' }) },
      { id: sid(5), pr: makePr({ state: 'queued' }) },
      { id: sid(6), pr: makePr({ state: 'closed' }) },
      { id: sid(7), pr: makePr({ state: 'merged' }) },
    ]);
    const result = sortAndGroupSessions(sessions, prefs, github);
    expect(keys(result)).toEqual([
      'not-open',
      'draft',
      'reviewable',
      'reviewed',
      'queued',
      'closed',
      'merged',
    ]);
  });

  it('closed takes precedence over isDraft=true', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ state: 'closed', isDraft: true }) }]),
    );
    expect(keys(result)).toEqual(['closed']);
  });

  it('omits empty pr buckets', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions([s], prefs, githubWith([{ id: sid(1), pr: null }]));
    expect(keys(result)).not.toContain('draft');
    expect(keys(result)).not.toContain('merged');
  });

  it('sessions in a bucket retain inner sort', () => {
    const a = makeSession(sid(1), { updatedAt: '2024-01-01T00:00:00.000Z' });
    const b = makeSession(sid(2), { updatedAt: '2024-01-05T00:00:00.000Z' });
    const github = githubWith([
      { id: sid(1), pr: null },
      { id: sid(2), pr: null },
    ]);
    const result = sortAndGroupSessions([a, b], prefs, github);
    expect(result[0]!.sessions.map((s) => s.id)).toEqual([sid(2), sid(1)]);
  });
});

describe('STAGE_ORDER', () => {
  it('defines building(0) → running(1) → attention(2) → review(3) → done(4)', () => {
    expect(STAGE_ORDER).toEqual({
      building: 0,
      running: 1,
      attention: 2,
      review: 3,
      done: 4,
    });
  });

  it('sorted keys produce the expected column sequence', () => {
    const sorted = (Object.entries(STAGE_ORDER) as Array<[string, number]>)
      .sort((a, b) => a[1] - b[1])
      .map(([k]) => k);
    expect(sorted).toEqual(['building', 'running', 'attention', 'review', 'done']);
  });
});
