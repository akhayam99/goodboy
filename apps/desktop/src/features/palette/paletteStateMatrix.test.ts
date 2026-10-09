import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { buildCommandList, flattenRows } from './commandList';
import { EMPTY_FRECENCY } from './frecency';
import { orderRunVerbs, paletteTierOf, type PaletteTier } from './paletteTiers';
import { liveAgentVerbs } from './sources/liveAgentEntries';
import type { PaletteEntry } from './types';
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
  isPinned: false,
  canMovePinUp: false,
  canMovePinDown: false,
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
      'Open Comments',
      'Open Files',
      'Open Terminal',
      'Open in editor',
      'Rename',
      'Pin session',
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

  it('hides Files and the editor on a session with no project until they are searched', () => {
    const facts = {
      ...LIVE,
      hasMount: false,
      branch: null,
      worktreePath: null,
      worktreePaths: [],
      prUrl: null,
    };

    expect(sessionView({ facts, query: '' })).toEqual([
      'Open Comments',
      'Open Terminal',
      'Rename',
      'Pin session',
      'Start agent',
      'Link work',
      'Copy title',
      'Archive',
      'Delete',
    ]);
    expect(sessionView({ facts, query: 'files' })).toEqual([
      'Open Files (Add a project to this session first)',
    ]);
    expect(sessionView({ facts, query: 'editor' })).toEqual([
      'Open in editor (This session has no worktree yet)',
    ]);
  });

  it('offers Unpin session instead of Pin session on a pinned session, and finds it by search', () => {
    const facts = { ...LIVE, isPinned: true };

    expect(sessionView({ facts, query: '' })).toContain('Unpin session');
    expect(sessionView({ facts, query: '' })).not.toContain('Pin session');
    expect(sessionView({ facts, query: 'unpin' })).toEqual(['Unpin session']);
    expect(sessionView({ facts: LIVE, query: 'pin session' })[0]).toBe('Pin session');
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
    expect(sessionView({ facts, query: 'pin session' })).not.toContain('Pin session');
    expect(sessionView({ facts: { ...facts, isPinned: true }, query: 'unpin' })).not.toContain(
      'Unpin session',
    );
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

const GOTO: PaletteEntry = {
  key: 'goto:board',
  label: 'Board',
  kind: 'goto',
  group: null,
  icon: Inbox,
  run: noop,
};

const APP: PaletteEntry = {
  key: 'action:new-session',
  label: 'New session',
  kind: 'action',
  group: 'action',
  icon: Inbox,
  run: noop,
};

const HELP: PaletteEntry = {
  key: 'help:guide',
  label: 'Guide',
  kind: 'help',
  group: 'help',
  icon: Inbox,
  run: noop,
};

const PAGE: PaletteEntry = {
  key: 'lens:agents',
  label: 'Open Agents',
  kind: 'page',
  group: 'action',
  icon: Inbox,
  run: noop,
};

const row = (key: string, label: string, kind: PaletteEntry['kind'] = 'next'): PaletteEntry => ({
  key,
  label,
  kind,
  group: null,
  icon: Inbox,
  run: noop,
});

const ALL_ACTIONS: PaletteEntry = {
  ...row('level:session-actions', 'All actions for this session', 'level'),
  level: { kind: 'actions', target: { kind: 'session', sessionId: SESSION_ID } },
};

const sessionVerbEntries = (facts: SessionFacts) => {
  const target: ObjectTarget = { kind: 'session', sessionId: SESSION_ID };
  return verbEntries({
    target,
    actions: resolveActions({ definitions: SESSION_KIND.actions, facts }),
    isScope: true,
    noun: 'session',
    select: noop,
  });
};

const liveVerbEntries = (facts: AgentFacts) =>
  liveAgentVerbs({
    verbs: verbEntries({
      target: { kind: 'agent', sessionId: SESSION_ID, agentId: AGENT_ID },
      actions: resolveActions({ definitions: AGENT_KIND.actions, facts }),
      isScope: true,
      noun: 'agent',
      select: noop,
    }),
    name: 'Implementer',
  });

type EmptyParams = {
  readonly tier: PaletteTier;
  readonly facts?: SessionFacts;
  readonly agent?: AgentFacts;
  readonly next?: ReadonlyArray<PaletteEntry>;
  readonly runs?: ReadonlyArray<PaletteEntry>;
};

const emptyScreen = ({ tier, facts = LIVE, agent = AGENT, next = [], runs = [] }: EmptyParams) =>
  buildCommandList({
    query: '',
    entries: [GOTO, PAGE, APP, HELP],
    scopeVerbs: [...sessionVerbEntries(facts), ...liveVerbEntries(agent)],
    scopeTitle: 'For this session',
    scopeKey: `session:${SESSION_ID}`,
    parentVerbs: [],
    parentTitle: null,
    frecency: EMPTY_FRECENCY,
    now: NOW,
    tier,
    isScopeSession: true,
    allActions: ALL_ACTIONS,
    next,
    runs,
  });

type Screen = ReturnType<typeof emptyScreen>;

const titles = (sections: Screen) => sections.map((section) => section.title);

const labelsOf = (sections: Screen, title: string) =>
  sections.find((section) => section.title === title)?.rows.map((entry) => entry.item.label) ?? [];

describe('paletteTierOf reads the state the session shows', () => {
  it.each([
    ['archived beats everything', true, 'attention', [], 'archived'],
    ['an open question is needs you', false, 'attention', [], 'needs'],
    ['a running agent is live', false, 'running', [], 'live'],
    ['a merged pull request is finished', false, 'done', [], 'finished'],
    ['an open pull request is ready to ship', false, 'review', [], 'ship'],
    ['unpushed commits are ready to ship', false, 'building', ['push-branch'], 'ship'],
    ['a rebase alone is still idle', false, 'building', ['rebase-project'], 'idle'],
    ['nothing going on is idle', false, 'building', [], 'idle'],
  ] as const)('%s', (_name, isArchived, stage, suggestionKinds, expected) => {
    expect(paletteTierOf({ isArchived, stage, suggestionKinds: [...suggestionKinds] })).toBe(
      expected,
    );
  });
});

describe('the empty palette ranks the session verbs by state', () => {
  it('idle: starting work comes first', () => {
    const screen = emptyScreen({ tier: 'idle' });

    expect(titles(screen)).toEqual(['For this session', 'Go to', 'App', 'Help']);
    expect(labelsOf(screen, 'For this session')).toEqual([
      'Start agent',
      'Link work',
      'Open Terminal',
      'Open in editor',
      'Open Files',
      'Rename',
      'Copy branch name',
      'Open Comments',
      'All actions for this session',
    ]);
  });

  it('needs you: the agent and the review come first', () => {
    expect(labelsOf(emptyScreen({ tier: 'needs' }), 'For this session').slice(0, 4)).toEqual([
      'Message Implementer',
      'Open Comments',
      'Start agent',
      'Open Terminal',
    ]);
  });

  it('live: interrupt and message the running agent first', () => {
    const screen = emptyScreen({ tier: 'live', agent: { ...AGENT, isTurnRunning: true } });

    expect(labelsOf(screen, 'For this session').slice(0, 5)).toEqual([
      'Interrupt Implementer',
      'Message Implementer',
      'Open Files',
      'Open Terminal',
      'Start agent',
    ]);
  });

  it('ready to ship: review and diff come first', () => {
    expect(labelsOf(emptyScreen({ tier: 'ship' }), 'For this session').slice(0, 4)).toEqual([
      'Open Comments',
      'Open Files',
      'Open in editor',
      'Open Terminal',
    ]);
  });

  it('finished: the pull request link comes first', () => {
    expect(labelsOf(emptyScreen({ tier: 'finished' }), 'For this session').slice(0, 3)).toEqual([
      'Copy PR link',
      'Open Comments',
      'Open Files',
    ]);
  });

  it('archived: restore and the copy verbs, nothing that changes the session', () => {
    const screen = emptyScreen({ tier: 'archived', facts: { ...LIVE, isArchived: true } });

    expect(labelsOf(screen, 'For this session')).toEqual([
      'Restore',
      'Copy title',
      'Copy worktree path',
      'Copy branch name',
      'Copy PR link',
      'All actions for this session',
    ]);
  });

  it.each(['idle', 'needs', 'live', 'ship', 'finished', 'archived'] as const)(
    '%s: at most eight verbs, never a danger verb, the All actions row last',
    (tier) => {
      const verbs = labelsOf(
        emptyScreen({ tier, agent: { ...AGENT, isTurnRunning: true } }),
        'For this session',
      );

      expect(verbs.length).toBeLessThanOrEqual(9);
      expect(verbs.at(-1)).toBe('All actions for this session');
      expect(verbs).not.toContain('Archive');
      expect(verbs).not.toContain('Delete');
    },
  );

  it('keeps the session pages out of the first screen and the App section small', () => {
    const screen = emptyScreen({ tier: 'idle' });

    expect(labelsOf(screen, 'Go to')).toEqual(['Board']);
    expect(labelsOf(screen, 'App')).toEqual(['New session']);
    expect(flattenRows(screen).map((entry) => entry.item.label)).not.toContain('Open Agents');
  });
});

describe('the empty palette puts Next and Runs around the verbs', () => {
  const NEXT = [row('next:push', 'Push 2 commits on feat/stream-payout-export')];
  const RUNS = [
    row('run:one', 'Ship a fix', 'run'),
    row('verb:workflowRun.close', 'Stop run', 'verb'),
  ];

  it('lists Next first, the verbs, then Runs, then Go to, App and Help', () => {
    expect(titles(emptyScreen({ tier: 'ship', next: NEXT, runs: RUNS }))).toEqual([
      'Next',
      'For this session',
      'Runs',
      'Go to',
      'App',
      'Help',
    ]);
  });

  it('hides Next and Runs when there is nothing to put in them', () => {
    expect(titles(emptyScreen({ tier: 'ship' }))).not.toContain('Next');
    expect(titles(emptyScreen({ tier: 'ship' }))).not.toContain('Runs');
  });

  it('finds a Next row and a run verb by typing, wherever the state ranked them', () => {
    const typed = (query: string) =>
      flattenRows(
        buildCommandList({
          query,
          entries: [GOTO, PAGE, APP, HELP],
          scopeVerbs: sessionVerbEntries(LIVE),
          scopeTitle: 'For this session',
          scopeKey: null,
          parentVerbs: [],
          parentTitle: null,
          frecency: EMPTY_FRECENCY,
          now: NOW,
          tier: 'idle',
          isScopeSession: true,
          extra: [...NEXT, ...RUNS],
        }),
      ).map((entry) => entry.item.label);

    expect(typed('push')).toEqual(['Push 2 commits on feat/stream-payout-export']);
    expect(typed('stop run')).toEqual(['Stop run']);
    expect(typed('open agents')).toEqual(['Open Agents']);
  });
});

describe('the empty palette on the Board', () => {
  it('puts the sessions that need you first, then Go to, App and Help', () => {
    const needs = [row('needs:one', 'Retry policy for 429s', 'needs')];
    const board = buildCommandList({
      query: '',
      entries: [GOTO, APP, HELP],
      scopeVerbs: [],
      scopeTitle: null,
      scopeKey: null,
      parentVerbs: [],
      parentTitle: null,
      frecency: EMPTY_FRECENCY,
      now: NOW,
      needsYou: needs,
    });

    expect(board.map((section) => section.title)).toEqual(['Needs you', 'Go to', 'App', 'Help']);
    expect(labelsOf(board, 'Needs you')).toEqual(['Retry policy for 429s']);
  });
});

describe('the run verbs follow the run state', () => {
  const verbs = (...labels: ReadonlyArray<readonly [string, string]>) =>
    labels.map(([id, label]): PaletteEntry => ({
      ...row(`verb:${id}`, label, 'verb'),
      action: { id } as PaletteEntry['action'],
    }));

  it('orders answer, continue, restart and stop, and drops what is not a run verb', () => {
    const ordered = orderRunVerbs({
      verbs: verbs(
        ['workflowRun.close', 'Stop run'],
        ['workflowRun.copySummary', 'Copy run summary'],
        ['workflowRun.restartStep', 'Restart step'],
        ['workflowRun.continue', 'Continue step'],
        ['workflowRun.answer', 'Answer'],
      ),
    }).map((entry) => entry.label);

    expect(ordered).toEqual(['Answer', 'Continue step', 'Restart step', 'Stop run']);
  });
});
