import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionEvent,
  SessionEventId,
  SessionId,
} from '@goodboy/types';
import { A_REBASE_AGENT_ID, A_REBASE_MOUNT_ID, aRebaseRun } from '../../history/testing/aRebaseRun';
import { jobFactsByAgentId } from '../../../store/slices/history/jobFactsByAgentId';
import type { HistoryRun } from '../../../store/slices/history/types';
import type { ScribeWork } from '../../../store/slices/scribe/types';
import { rowStateNode, rowStateSentence, rowStateTone } from '../../workTreeModel/rowStateCopy';
import type { AgentKind } from '../agent-kind';
import { buildTimelineGroups } from './buildTimelineGroups';
import { buildTimelineStream, type TimelineRowItem } from './buildTimelineStream';
import { dayLabel } from './dayLabel';
import { needsYouOwners } from './needsYou';
import { brandedId } from '../../history/testing/brandedId';

const SESSION_ID = brandedId<SessionId>({ value: 'session-payments' });
const NOW = new Date(2026, 9, 10, 12, 0);

const finishedAgent = ({ id, name }: { readonly id: string; readonly name: string }): Agent => ({
  id: brandedId<AgentId>({ value: id }),
  sessionId: SESSION_ID,
  ordinal: 1,
  name,
  status: 'completed',
  startedAt: brandedId<IsoDateTime>({ value: new Date(2026, 9, 10, 9, 0).toISOString() }),
  completedAt: brandedId<IsoDateTime>({ value: new Date(2026, 9, 10, 9, 0, 39).toISOString() }),
});

const scribeWork = (patch: Partial<ScribeWork>): ScribeWork => ({
  key: 'pr:mount-payments',
  sessionId: SESSION_ID,
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

const rowsFor = ({
  agents,
  kinds,
  run,
  work = [],
  events = [],
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly kinds: Readonly<Record<string, AgentKind>>;
  readonly run?: HistoryRun;
  readonly work?: ReadonlyArray<ScribeWork>;
  readonly events?: ReadonlyArray<SessionEvent>;
}) => {
  const { items } = buildTimelineStream({
    entries: buildTimelineGroups({
      sessionId: SESSION_ID,
      agents,
      workflows: [],
      plans: [],
      artifacts: [],
      externalTasks: [],
      questions: [],
      worktrees: [],
      events,
      agentKindOverride: kinds,
    }).entries,
    unreadAgentIds: new Set(),
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    dayLabelFor: ({ at }) => dayLabel({ at, now: NOW }),
    jobFactsByAgentId: jobFactsByAgentId({
      sessionId: SESSION_ID,
      historyRuns: run === undefined ? {} : { [A_REBASE_MOUNT_ID]: run },
      scribeWork: Object.fromEntries(work.map((entry) => [entry.key, entry])),
      events,
      contextOf: () => ({ projectName: 'payments-api', baseBranch: 'main' }),
    }),
  });
  const rows = items.filter((item): item is TimelineRowItem => item.kind === 'row');
  return { items, byId: new Map(rows.map((row) => [row.id, row])) };
};

const REWRITER = finishedAgent({ id: A_REBASE_AGENT_ID, name: 'History rewriter' });
const SCRIBE = finishedAgent({ id: 'agent-scribe', name: 'Scribe' });

describe('the history rewriter row reads the job, not the turn', () => {
  it('reads Stopped when the turn ended and the job stopped', () => {
    const run = aRebaseRun({
      phase: 'stopped',
      agentId: A_REBASE_AGENT_ID,
      stop: { reason: 'stuck', message: 'x', files: ['webhook.ts'], sha: null },
    });
    const { byId } = rowsFor({
      agents: [REWRITER],
      kinds: { [A_REBASE_AGENT_ID]: 'rewriter' },
      run,
    });
    const row = byId.get(`agent:${A_REBASE_AGENT_ID}`);

    expect(row && rowStateSentence({ state: row.rowState })).toBe('Stopped: needs you');
    expect(row && rowStateTone({ state: row.rowState })).toBe('warning');
    expect(row && rowStateNode({ state: row.rowState }).state).not.toBe('done');
    expect(row?.rowState.phase).toBe('waiting');
  });

  it('reads Merging while the job runs even when the turn is finished', () => {
    const run = aRebaseRun({ phase: 'rewriting', agentId: A_REBASE_AGENT_ID });
    const { byId } = rowsFor({
      agents: [REWRITER],
      kinds: { [A_REBASE_AGENT_ID]: 'rewriter' },
      run,
    });
    const row = byId.get(`agent:${A_REBASE_AGENT_ID}`);

    expect(row && rowStateSentence({ state: row.rowState })).toBe('Merging');
    expect(row?.rowState.phase).toBe('running');
  });

  it('reads Done from the event after a restart', () => {
    const pushed: SessionEvent = {
      id: brandedId<SessionEventId>({ value: 'ev-1' }),
      sessionId: SESSION_ID,
      kind: 'history_pushed',
      payload: { origin: 'rebase', mountId: A_REBASE_MOUNT_ID, agentId: A_REBASE_AGENT_ID },
      createdAt: brandedId<IsoDateTime>({ value: '2026-10-10T09:10:00.000Z' }),
    };
    const { byId } = rowsFor({
      agents: [REWRITER],
      kinds: { [A_REBASE_AGENT_ID]: 'rewriter' },
      events: [pushed],
    });
    const row = byId.get(`agent:${A_REBASE_AGENT_ID}`);

    expect(row && rowStateSentence({ state: row.rowState })).toBe('Done');
    expect(row?.rowState.reason).toMatchObject({ kind: 'job', title: 'Rebase on main' });
  });

  it('keeps the agent state for a rewriter no job knows', () => {
    const { byId } = rowsFor({ agents: [REWRITER], kinds: { [A_REBASE_AGENT_ID]: 'rewriter' } });

    expect(byId.get(`agent:${A_REBASE_AGENT_ID}`)?.rowState.reason).toBeNull();
  });
});

describe('the Scribe row reads the job, not the turn', () => {
  it('reads Writing while scribeWork writes', () => {
    const { byId } = rowsFor({
      agents: [SCRIBE],
      kinds: { 'agent-scribe': 'scribe' },
      work: [scribeWork({ status: 'writing' })],
    });
    const row = byId.get('agent:agent-scribe');

    expect(row && rowStateSentence({ state: row.rowState })).toBe('Writing');
    expect(row?.rowState.phase).toBe('running');
    expect(row?.rowState.reason).toMatchObject({ title: 'Pull request text', isMuted: false });
  });

  it('reads Created #318 once the pull request exists', () => {
    const { byId } = rowsFor({
      agents: [SCRIBE],
      kinds: { 'agent-scribe': 'scribe' },
      work: [scribeWork({ status: 'created', pullRequest: { number: 318, url: 'u' } })],
    });
    const row = byId.get('agent:agent-scribe');

    expect(row && rowStateSentence({ state: row.rowState })).toBe('Created #318');
    expect(row?.rowState.phase).toBe('done');
  });

  it('mutes an automatic Scribe and never puts it in Needs you', () => {
    const refresh = scribeWork({
      key: 'pr-update:m',
      task: { kind: 'pr-update', prNumber: 318 },
      status: 'failed',
    });
    const { items, byId } = rowsFor({
      agents: [SCRIBE],
      kinds: { 'agent-scribe': 'scribe' },
      work: [refresh],
    });
    const row = byId.get('agent:agent-scribe');

    expect(row?.rowState.reason).toMatchObject({
      title: 'Refresh pull request text',
      isMuted: true,
    });
    expect(row?.rowState.ask).toBeNull();
    expect(needsYouOwners({ items, entries: [], events: [] })).toEqual([]);
  });
});

describe('Needs you for a stopped rebase', () => {
  it('shows a short cause, never the engine sentence', () => {
    const stopped: SessionEvent = {
      id: brandedId<SessionEventId>({ value: 'ev-2' }),
      sessionId: SESSION_ID,
      kind: 'history_stopped',
      payload: {
        origin: 'rebase',
        mountId: A_REBASE_MOUNT_ID,
        branch: 'hl/fix-duplicate-credit',
        reason: 'dirty',
        title: '11 files have changes that are not committed. Commit or stash them first.',
      },
      createdAt: brandedId<IsoDateTime>({ value: '2026-10-10T09:10:00.000Z' }),
    };
    const { items } = rowsFor({ agents: [], kinds: {}, events: [stopped] });
    const owners = needsYouOwners({ items, entries: [], events: [stopped] });

    expect(owners.map((owner) => owner.text)).toEqual([
      'Rebase of hl/fix-duplicate-credit stopped · uncommitted files',
    ]);
  });
});
