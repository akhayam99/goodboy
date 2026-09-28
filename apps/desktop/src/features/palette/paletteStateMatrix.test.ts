import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { buildCommandList, flattenRows } from './commandList';
import { EMPTY_FRECENCY } from './frecency';
import { AGENT_KIND, type AgentFacts } from '../actions/kinds/agent';
import { COMMIT_KIND, type CommitFacts } from '../actions/kinds/commit';
import { resolveActions } from '../actions/resolveActions';
import { SESSION_KIND, type SessionFacts } from '../actions/kinds/session';
import type { ObjectTarget } from '../actions/types';
import { verbEntries } from './sources/verbEntries';

const NOW = Date.parse('2026-09-28T09:00:00Z');
const SESSION_ID = 'session-payout' as SessionId;
const AGENT_ID = 'agent-implementer' as AgentId;

const LIVE: SessionFacts = {
  session: { id: SESSION_ID, goal: 'Speed up the payout export' } as Session,
  sessionId: SESSION_ID,
  title: 'Speed up the payout export',
  isArchived: false,
  isBranchless: false,
  hasMount: true,
  branch: 'feat/stream-payout-export',
  worktreePath: '/worktrees/ledger-core',
  mounts: [],
  worktreePaths: ['/worktrees/ledger-core'],
  prUrl: 'https://example.test/harborline/ledger-core/pull/318',
};

const AGENT: AgentFacts = {
  agent: { id: AGENT_ID, name: 'Implementer' } as Agent,
  sessionId: SESSION_ID,
  name: 'Implementer',
  status: 'completed',
  isTurnLive: false,
  isTurnRunning: false,
  hasOpenQuestion: false,
  isClosable: false,
  isClosedByUser: false,
  isWorkflowStep: false,
  hasMount: true,
  lastReply: null,
  provider: 'anthropic',
  modelKey: null,
  hiddenModels: null,
};

type ViewParams<F> = {
  readonly facts: F;
  readonly query: string;
};

type RowsParams = {
  readonly target: ObjectTarget;
  readonly verbs: ReturnType<typeof verbEntries>;
  readonly query: string;
};

const view = ({ target, verbs, query }: RowsParams) =>
  flattenRows(
    buildCommandList({
      query,
      entries: [],
      scopeVerbs: verbs,
      scopeTitle: 'For this object',
      scopeKey: `${target.kind}:scope`,
      parentVerbs: [],
      parentTitle: null,
      frecency: EMPTY_FRECENCY,
      now: NOW,
    }),
  ).map((row) =>
    row.item.isBlocked === true ? `${row.item.label} (${row.item.detail})` : row.item.label,
  );

const sessionView = ({ facts, query }: ViewParams<SessionFacts>) => {
  const target: ObjectTarget = { kind: 'session', sessionId: SESSION_ID };
  const actions = resolveActions({ definitions: SESSION_KIND.actions, facts });
  return view({
    target,
    verbs: verbEntries({
      target,
      actions,
      isScope: true,
      noun: 'session',
      select: () => undefined,
    }),
    query,
  });
};

const agentView = ({ facts, query }: ViewParams<AgentFacts>) => {
  const target: ObjectTarget = { kind: 'agent', sessionId: SESSION_ID, agentId: AGENT_ID };
  const actions = resolveActions({ definitions: AGENT_KIND.actions, facts });
  return view({
    target,
    verbs: verbEntries({ target, actions, isScope: true, noun: 'agent', select: () => undefined }),
    query,
  });
};

const noop = () => undefined;

const COMMIT: CommitFacts = {
  sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
  shortSha: 'b2c3d4e',
  subject: 'Keep trailing-comma rows in the ledger-core importer',
  isFolded: false,
  isRemoved: false,
  canRemove: true,
  canFoldDown: true,
  onRename: noop,
  onFoldDown: noop,
  onSquashDown: noop,
  onToggleRemove: noop,
  onSeparate: noop,
  onMove: noop,
};

const commitView = ({ facts, query }: ViewParams<CommitFacts>) => {
  const target: ObjectTarget = { kind: 'commit', facts };
  const actions = resolveActions({ definitions: COMMIT_KIND.actions, facts });
  return view({
    target,
    verbs: verbEntries({ target, actions, isScope: true, noun: 'commit', select: noop }),
    query,
  });
};

describe('palette verbs follow the session state', () => {
  it('offers every live verb on a session with a project, a worktree and a pull request', () => {
    expect(sessionView({ facts: LIVE, query: '' })).toEqual([
      'Open Review',
      'Open Diff',
      'Open Terminal',
      'Open in editor',
      'Rename',
      'Start agent',
      'Link work',
      'Copy title',
      'Copy worktree path',
      'Copy branch name',
      'Copy PR link',
      'Archive',
      'Delete',
    ]);
  });

  it('hides Diff and the editor on a session with no project until they are searched', () => {
    const facts = {
      ...LIVE,
      hasMount: false,
      branch: null,
      worktreePath: null,
      worktreePaths: [],
      prUrl: null,
    };

    expect(sessionView({ facts, query: '' })).toEqual([
      'Open Review',
      'Open Terminal',
      'Rename',
      'Start agent',
      'Link work',
      'Copy title',
      'Archive',
      'Delete',
    ]);
    expect(sessionView({ facts, query: 'diff' })).toEqual([
      'Open Diff (Add a project to this session first)',
    ]);
    expect(sessionView({ facts, query: 'editor' })).toEqual([
      'Open in editor (This session has no worktree yet)',
    ]);
  });

  it('offers Restore, never Archive or a lens, on an archived session', () => {
    const facts = { ...LIVE, isArchived: true };

    expect(sessionView({ facts, query: '' })).toEqual([
      'Restore',
      'Copy title',
      'Copy worktree path',
      'Copy branch name',
      'Copy PR link',
      'Delete',
    ]);
    for (const query of ['archive', 'review', 'diff', 'terminal', 'editor', 'rename', 'start']) {
      expect(sessionView({ facts, query })).toEqual([]);
    }
  });
});

describe('palette verbs follow the agent state', () => {
  it('offers Interrupt only while a turn runs', () => {
    expect(agentView({ facts: { ...AGENT, isTurnRunning: true }, query: '' })).toContain(
      'Interrupt',
    );
    expect(agentView({ facts: AGENT, query: 'interrupt' })).toEqual([]);
  });

  it('offers Close on a halted agent and Reopen on one closed by hand', () => {
    const halted = agentView({ facts: { ...AGENT, isClosable: true }, query: '' });
    const closed = agentView({ facts: { ...AGENT, isClosedByUser: true }, query: '' });

    expect(halted).toContain('Close');
    expect(halted).not.toContain('Reopen');
    expect(closed).toContain('Reopen');
    expect(closed).not.toContain('Close');
  });

  it('stops offering Message and Change model once the agent is closed by hand', () => {
    expect(agentView({ facts: AGENT, query: '' })).toEqual(
      expect.arrayContaining(['Message this agent', 'Change model']),
    );
    const closed = agentView({ facts: { ...AGENT, isClosedByUser: true }, query: 'message' });
    expect(closed).toEqual([]);
  });

  it('never offers Close to an agent that is running or already closed', () => {
    expect(agentView({ facts: { ...AGENT, isTurnRunning: true }, query: 'close' })).toEqual([]);
    expect(agentView({ facts: { ...AGENT, isClosedByUser: true }, query: 'close' })).toEqual([]);
  });
});

describe('palette verbs follow the commit state, in the order of its ⋯ menu', () => {
  it.each([
    [
      'commit with one below',
      COMMIT,
      [
        'Rename',
        'Fold down',
        'Squash down',
        'Move up',
        'Move down',
        'Copy SHA',
        'Copy subject',
        'Remove',
      ],
    ],
    [
      'oldest commit that takes others in',
      { ...COMMIT, canFoldDown: false, canRemove: false },
      ['Rename', 'Move up', 'Move down', 'Copy SHA', 'Copy subject'],
    ],
    [
      'commit folded into another',
      { ...COMMIT, isFolded: true },
      ['Separate', 'Copy SHA', 'Copy subject'],
    ],
    [
      'removed commit',
      { ...COMMIT, isRemoved: true },
      [
        'Rename',
        'Fold down',
        'Squash down',
        'Move up',
        'Move down',
        'Keep',
        'Copy SHA',
        'Copy subject',
      ],
    ],
  ] as const)('%s', (_state, facts, expected) => {
    expect(commitView({ facts, query: '' })).toEqual(expected);
  });

  it('shows a blocked verb with its reason once it is searched', () => {
    const facts = { ...COMMIT, canFoldDown: false, canRemove: false };

    expect(commitView({ facts, query: 'squash' })).toEqual([
      'Squash down (Nothing below to combine with)',
    ]);
    expect(commitView({ facts, query: 'remove' })).toEqual([
      'Remove (Separate what it takes in first)',
    ]);
  });
});
