import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { buildCommandList, flattenRows } from './commandList';
import { EMPTY_FRECENCY } from './frecency';
import { AGENT_KIND, type AgentFacts } from './interimActions/agentKind';
import { resolveActions } from './interimActions/registry';
import { SESSION_KIND, type SessionFacts } from './interimActions/sessionKind';
import type { ObjectTarget } from './interimActions/types';
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
  prUrl: 'https://example.test/harborline/ledger-core/pull/318',
};

const AGENT: AgentFacts = {
  agent: { id: AGENT_ID, name: 'Implementer' } as Agent,
  sessionId: SESSION_ID,
  name: 'Implementer',
  isTurnRunning: false,
  isClosable: false,
  isClosedByUser: false,
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

describe('palette verbs follow the session state', () => {
  it('offers every live verb on a session with a project, a worktree and a pull request', () => {
    expect(sessionView({ facts: LIVE, query: '' })).toEqual([
      'Open Review',
      'Open Diff',
      'Open Terminal',
      'Open in editor',
      'Copy title',
      'Copy branch name',
      'Copy PR link',
      'Archive',
      'Delete',
    ]);
  });

  it('hides Diff and the editor on a session with no project until they are searched', () => {
    const facts = { ...LIVE, hasMount: false, branch: null, worktreePath: null, prUrl: null };

    expect(sessionView({ facts, query: '' })).toEqual([
      'Open Review',
      'Open Terminal',
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
      'Copy branch name',
      'Copy PR link',
      'Delete',
    ]);
    for (const query of ['archive', 'review', 'diff', 'terminal', 'editor']) {
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

  it('never offers Close to an agent that is running or already closed', () => {
    expect(agentView({ facts: { ...AGENT, isTurnRunning: true }, query: 'close' })).toEqual([]);
    expect(agentView({ facts: { ...AGENT, isClosedByUser: true }, query: 'close' })).toEqual([]);
  });
});
