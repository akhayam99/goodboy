import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime, SessionEvent, SessionEventId, SessionId } from '@goodboy/types';
import {
  A_REBASE_AGENT_ID,
  A_REBASE_MOUNT_ID,
  A_REBASE_SESSION_ID,
  aRebaseRun,
} from '../../../features/history/testing/aRebaseRun';
import type { ScribeWork } from '../scribe/types';
import { jobFactsByAgentId } from './jobFactsByAgentId';
import type { HistoryRun } from './types';
import { brandedId } from '../../../features/history/testing/brandedId';

const contextOf = () => ({ projectName: 'payments-api', baseBranch: 'main' });

const factsOf = ({
  run,
  work = [],
  events = [],
}: {
  readonly run?: HistoryRun;
  readonly work?: ReadonlyArray<ScribeWork>;
  readonly events?: ReadonlyArray<SessionEvent>;
}) =>
  jobFactsByAgentId({
    sessionId: A_REBASE_SESSION_ID,
    historyRuns: run === undefined ? {} : { [A_REBASE_MOUNT_ID]: run },
    scribeWork: Object.fromEntries(work.map((entry) => [entry.key, entry])),
    events,
    contextOf,
  });

const scribe = (patch: Partial<ScribeWork>): ScribeWork => ({
  key: 'pr:mount-payments',
  sessionId: A_REBASE_SESSION_ID,
  mountId: A_REBASE_MOUNT_ID,
  agentId: brandedId<AgentId>({ value: 'agent-scribe' }),
  task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: false, base: null },
  status: 'writing',
  output: null,
  error: null,
  pullRequest: null,
  updatedAt: 0,
  ...patch,
});

const event = ({
  id,
  kind,
  at,
  payload,
}: {
  readonly id: string;
  readonly kind: SessionEvent['kind'];
  readonly at: string;
  readonly payload: NonNullable<SessionEvent['payload']>;
}): SessionEvent => ({
  id: brandedId<SessionEventId>({ value: id }),
  sessionId: A_REBASE_SESSION_ID,
  kind,
  payload,
  createdAt: brandedId<IsoDateTime>({ value: at }),
});

describe('the rows of a rebase job', () => {
  it('reads a merging rewriter as running, whatever its turn did', () => {
    const run = aRebaseRun({
      phase: 'rewriting',
      agentId: A_REBASE_AGENT_ID,
      stop: { reason: 'conflict', message: '', files: ['webhook.ts'], sha: null },
    });

    expect(factsOf({ run }).get(A_REBASE_AGENT_ID)).toMatchObject({
      title: 'Rebase on main',
      word: 'Merging',
      phase: 'running',
    });
  });

  it('reads a stopped rewriter as waiting on you with the cause', () => {
    const run = aRebaseRun({
      phase: 'stopped',
      agentId: A_REBASE_AGENT_ID,
      stop: { reason: 'stuck', message: 'x', files: ['webhook.ts'], sha: null },
    });

    expect(factsOf({ run }).get(A_REBASE_AGENT_ID)).toMatchObject({
      word: 'Stopped: needs you',
      phase: 'waiting',
    });
  });

  it('reads a failed rebase as failed and a finished one as done', () => {
    const failed = aRebaseRun({
      phase: 'stopped',
      agentId: A_REBASE_AGENT_ID,
      stop: { reason: 'push-failed', message: 'pre-push hook', files: [], sha: null },
    });
    const done = aRebaseRun({ phase: 'pushed', agentId: A_REBASE_AGENT_ID });

    expect(factsOf({ run: failed }).get(A_REBASE_AGENT_ID)).toMatchObject({
      word: 'Stopped: hook stopped the push',
      phase: 'failed',
    });
    expect(factsOf({ run: done }).get(A_REBASE_AGENT_ID)).toMatchObject({
      word: 'Done',
      phase: 'done',
    });
  });

  it('leaves the rewriter of a plan the user wrote to its agent', () => {
    const run = aRebaseRun({ origin: 'plan', phase: 'rewriting', agentId: A_REBASE_AGENT_ID });

    expect(factsOf({ run }).size).toBe(0);
  });

  it('ignores a run of another session', () => {
    const run = aRebaseRun({ phase: 'rewriting', agentId: A_REBASE_AGENT_ID });

    expect(
      jobFactsByAgentId({
        sessionId: brandedId<SessionId>({ value: 'session-other' }),
        historyRuns: { [A_REBASE_MOUNT_ID]: run },
        scribeWork: {},
        events: [],
        contextOf,
      }).size,
    ).toBe(0);
  });
});

describe('the rows of a rebase job after a restart', () => {
  const rewritten = event({
    id: 'ev-1',
    kind: 'history_rewritten',
    at: '2026-10-10T09:00:00.000Z',
    payload: { origin: 'rebase', mountId: A_REBASE_MOUNT_ID, agentId: A_REBASE_AGENT_ID },
  });

  it('reads Done from the events when the run is gone', () => {
    expect(factsOf({ events: [rewritten] }).get(A_REBASE_AGENT_ID)).toMatchObject({
      title: 'Rebase on main',
      word: 'Done',
      phase: 'done',
    });
  });

  it('reads Stopped from the latest event of the agent', () => {
    const stopped = event({
      id: 'ev-2',
      kind: 'history_stopped',
      at: '2026-10-10T09:05:00.000Z',
      payload: {
        origin: 'rebase',
        mountId: A_REBASE_MOUNT_ID,
        agentId: A_REBASE_AGENT_ID,
        reason: 'stuck',
      },
    });

    expect(factsOf({ events: [rewritten, stopped] }).get(A_REBASE_AGENT_ID)).toMatchObject({
      word: 'Stopped: needs you',
      phase: 'waiting',
    });
    expect(factsOf({ events: [stopped, rewritten] }).get(A_REBASE_AGENT_ID)?.word).toBe(
      'Stopped: needs you',
    );
  });

  it('prefers the live run over an older event', () => {
    const run = aRebaseRun({ phase: 'rewriting', agentId: A_REBASE_AGENT_ID });

    expect(factsOf({ run, events: [rewritten] }).get(A_REBASE_AGENT_ID)?.word).toBe('Merging');
  });

  it('skips events of a plan and events with no agent', () => {
    const plan = event({
      id: 'ev-3',
      kind: 'history_rewritten',
      at: '2026-10-10T09:00:00.000Z',
      payload: { origin: 'plan', agentId: A_REBASE_AGENT_ID },
    });
    const anonymous = event({
      id: 'ev-4',
      kind: 'history_rewritten',
      at: '2026-10-10T09:00:00.000Z',
      payload: { origin: 'rebase' },
    });

    expect(factsOf({ events: [plan, anonymous] }).size).toBe(0);
  });
});

describe('the rows of Scribe', () => {
  it('reads Writing while Scribe writes the pull request text', () => {
    expect(factsOf({ work: [scribe({ status: 'writing' })] }).get('agent-scribe')).toMatchObject({
      title: 'Pull request text',
      word: 'Writing',
      phase: 'running',
      isAutomatic: false,
    });
  });

  it('walks Opening, Created #318 and Could not open', () => {
    const word = (patch: Partial<ScribeWork>) =>
      factsOf({ work: [scribe(patch)] }).get('agent-scribe')?.word;

    expect(word({ status: 'creating' })).toBe('Opening');
    expect(word({ status: 'created', pullRequest: { number: 318, url: 'u' } })).toBe(
      'Created #318',
    );
    expect(
      word({
        status: 'failed',
        output: { prTitle: 'a', prBody: 'b', commitMessages: [], changelogEntry: null },
      }),
    ).toBe("Couldn't open");
    expect(word({ status: 'failed' })).toBe("Couldn't write");
  });

  it('mutes the Scribe that refreshes a description and the one that writes a commit message', () => {
    const refresh = scribe({
      key: 'pr-update:m',
      agentId: brandedId<AgentId>({ value: 'agent-refresh' }),
      task: { kind: 'pr-update', prNumber: 318 },
    });
    const commit = scribe({
      key: 'commit-message:m',
      agentId: brandedId<AgentId>({ value: 'agent-commit' }),
      task: { kind: 'commit-message', verb: 'reword', commits: [] },
    });
    const facts = factsOf({ work: [refresh, commit] });

    expect(facts.get('agent-refresh')).toMatchObject({
      title: 'Refresh pull request text',
      isAutomatic: true,
    });
    expect(facts.get('agent-commit')).toMatchObject({ title: 'Commit message', isAutomatic: true });
  });

  it('has no row for a Scribe that never got an agent', () => {
    expect(factsOf({ work: [scribe({ agentId: null })] }).size).toBe(0);
  });
});
