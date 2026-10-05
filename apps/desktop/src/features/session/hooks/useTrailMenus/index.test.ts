// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CrumbMenuAction, CrumbMenuModel, CrumbMenuRow } from '@goodboy/ui';
import { Circle } from 'lucide-react';
import type {
  Agent,
  AgentId,
  ArtifactId,
  ResolveAttempt,
  SessionArtifact,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { TEST_NOW, aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import type { BreadcrumbCrumb } from '../../breadcrumbCrumb';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  signals: {
    openQuestionAgentIds: new Set<string>(),
    liveTurnAgentIds: new Set<string>(),
  },
  attachedRuns: [] as ReadonlyArray<unknown>,
  selectedRun: null as unknown,
  destinations: [] as ReadonlyArray<unknown>,
  summaries: {} as Record<string, string>,
  queueRows: [] as ReadonlyArray<unknown>,
  threadId: null as string | null,
  branchPrs: [] as ReadonlyArray<unknown>,
  mergedMounts: new Set<string>(),
  diffStats: new Map<string, { additions: number; deletions: number }>(),
  statuses: new Map<string, unknown>(),
  resolveAgain: vi.fn(),
  openLens: vi.fn(),
  openUrl: vi.fn(),
  copy: vi.fn(),
  revealMirror: vi.fn(),
  locateMirror: vi.fn(),
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [],
  useAppStore: Object.assign(<T>(selector: (state: typeof h.state) => T) => selector(h.state), {
    getState: () => h.state,
  }),
  useMountDiffStats: () => h.diffStats,
}));
vi.mock('../../../../store/slices/worktrees/resolveSessionRepo', () => ({
  resolveSessionRepo: () => null,
}));
vi.mock('../../../../store/slices/project-mounts/mountRowModel', () => ({
  isMountRequestMerged: ({ mountId }: { mountId: string }) => h.mergedMounts.has(mountId),
}));
vi.mock('../../../../store/slices/navigation/resolverThread', () => ({
  resolverThread: () => h.threadId,
}));
vi.mock('../../../../store/slices/github/activeProjectPrs', () => ({
  selectActiveProjectPrs: () => h.branchPrs,
}));
vi.mock('../useAgentLifecycleSignals', () => ({ useAgentLifecycleSignals: () => h.signals }));
vi.mock('../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => h.attachedRuns,
}));
vi.mock('../useSelectedWorkflowRun', () => ({ useSelectedWorkflowRun: () => h.selectedRun }));
vi.mock('../useLensDestinations', () => ({ useLensDestinations: () => h.destinations }));
vi.mock('../usePageSummaries', () => ({ usePageSummaries: () => h.summaries }));
vi.mock('../useWorktreeStatuses', () => ({ useWorktreeStatuses: () => h.statuses }));
vi.mock('../../../resolve/hooks/useResolveQueueRows', () => ({
  useResolveQueueRows: () => h.queueRows,
}));
vi.mock('../../../resolve/hooks/useResolveAgain', () => ({
  useResolveAgain: () => h.resolveAgain,
}));
vi.mock('../../openLens', () => ({ openLens: h.openLens }));
vi.mock('../../../../shared/lib/editor', () => ({ openUrl: h.openUrl }));
vi.mock('../../../artifacts/artifactMirror/artifactMirrorInvoke', () => ({
  revealArtifactMirror: h.revealMirror,
  locateArtifactMirror: h.locateMirror,
}));
vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  useCopyLink: () => ({ copy: h.copy }),
}));

import { lensDestinations } from '../../lens-destinations';
import { createAgentEventName } from '../../createAgentEventName';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { useTrailMenus } from '.';

const SESSION_ID = 'session-1' as SessionId;
const session = aSession({
  id: SESSION_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Fix ledger',
});
const RUN_ID = 'run-1' as WorkflowRunId;
const STEP_ONE_ID = 'step-1' as StepId;
const STEP_TWO_ID = 'step-2' as StepId;

const agent = (overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  anAgent({ sessionId: SESSION_ID, name: overrides.id, status: 'completed', ...overrides });

const scout = agent({ id: 'agent-scout' as AgentId, name: 'scout one', ordinal: 0 });
const implementer = agent({
  id: 'agent-impl' as AgentId,
  name: 'implement two',
  kind: 'implementer',
  ordinal: 1,
  status: 'running',
});
const stepOne = agent({
  id: 'agent-step-1' as AgentId,
  name: 'draft step',
  ordinal: 2,
  status: 'completed',
  stepId: STEP_ONE_ID,
  workflowRunId: RUN_ID,
});
const stepTwo = agent({
  id: 'agent-step-2' as AgentId,
  name: 'review step',
  ordinal: 3,
  status: 'failed',
  stepId: STEP_TWO_ID,
  workflowRunId: RUN_ID,
});
const child = agent({
  id: 'agent-child' as AgentId,
  name: 'area alpha',
  kind: 'implementer',
  ordinal: 4,
  status: 'running',
  parentAgentId: stepOne.id,
  workflowRunId: RUN_ID,
});
const resolver = agent({
  id: 'agent-resolver' as AgentId,
  name: 'resolver',
  kind: 'resolver',
  ordinal: 5,
  status: 'running',
});

const workflow: Workflow = {
  id: 'workflow-1' as WorkflowId,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'refactor',
  description: 'Refactor the ledger',
  steps: [
    {
      id: STEP_ONE_ID,
      workflowId: 'workflow-1' as WorkflowId,
      ordinal: 0,
      name: 'Draft',
      role: 'planner',
      promptPrefix: 'Draft',
    },
    {
      id: STEP_TWO_ID,
      workflowId: 'workflow-1' as WorkflowId,
      ordinal: 1,
      name: 'Review',
      role: 'reviewer',
      promptPrefix: 'Review',
      modelOverride: 'opus',
    },
  ],
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};
const run = aWorkflowRun({
  id: RUN_ID,
  workflowId: workflow.id,
  title: 'Refactor ledger',
});
const runTwo = aWorkflowRun({
  id: 'run-2' as WorkflowRunId,
  workflowId: workflow.id,
  ordinal: 1,
});

const attempt = (overrides: Partial<ResolveAttempt> & Pick<ResolveAttempt, 'id'>) =>
  ({
    agentId: 'agent-resolver' as AgentId,
    threadIds: ['thread-1'],
    phase: 'finished',
    createdAt: 1_000,
    model: 'sonnet',
    ...overrides,
  }) as ResolveAttempt;

const queueRow = (threadId: string, overrides: Record<string, unknown> = {}) => ({
  thread: { threadId },
  status: 'new',
  attempt: null,
  reviewerNote: null,
  commentThread: {
    head: {
      body: `Rename ${threadId}\nsecond line`,
      path: 'src/ledger.ts',
      line: 12,
      url: `https://example.test/${threadId}`,
    },
  },
  ...overrides,
});

const mount = (name: string, branch: string) => ({
  mountId: `mount-${name}`,
  mountName: name,
  branch,
  worktreePath: `/work/${name}`,
  repoRoot: `/repo/${name}`,
  baseBranch: 'main',
  projectId: 'project-1',
});

const pr = (number: number, title: string) => ({
  number,
  title,
  state: 'open',
  isDraft: false,
  headBranch: 'ak/feat-ledger',
});

const artifact = (overrides: Partial<SessionArtifact> & Pick<SessionArtifact, 'id'>) =>
  ({
    kind: 'plan',
    title: overrides.id,
    revision: 2,
    createdAt: TEST_NOW,
    updatedAt: '2026-09-30T10:00:00.000Z',
    status: 'active',
    agentId: null,
    ...overrides,
  }) as SessionArtifact;

const crumb = (id: string): BreadcrumbCrumb => ({ id, label: id, icon: Circle });

const reportError = vi.fn();
const navigate = vi.fn();
const setFocusedWorkflowRun = vi.fn();
const setFocusedArtifactId = vi.fn();
const cancelCurrentTurn = vi.fn();
const recoverStuckStep = vi.fn();
const setSessionActiveMount = vi.fn(async () => undefined);
const selectSessionPr = vi.fn();
const setPullRequestMode = vi.fn();

const resetState = () => {
  Object.keys(h.state).forEach((key) => delete h.state[key]);
  Object.assign(h.state, {
    selectedAgentId: {},
    sessionPhaseRuns: { [SESSION_ID]: [scout, implementer, stepOne, stepTwo, child, resolver] },
    agentKindOverride: {},
    focusedWorkflowRunId: {},
    focusedArtifactId: {},
    sessionArtifacts: {},
    sessionResolveAttempts: {},
    workspaces: [{ id: 'workspace-1', slug: 'harborline' }],
    sessionProjectMounts: {},
    diffMountPath: {},
    projects: [],
    sessionGithub: {},
    sessionSelectedPrNumber: {},
    navigate,
    setFocusedWorkflowRun,
    setFocusedArtifactId,
    cancelCurrentTurn,
    recoverStuckStep,
    reportError,
    setSessionActiveMount,
    selectSessionPr,
    setPullRequestMode,
  });
};

beforeEach(() => {
  resetState();
  h.signals = { openQuestionAgentIds: new Set(), liveTurnAgentIds: new Set() };
  h.attachedRuns = [];
  h.selectedRun = null;
  h.destinations = lensDestinations({
    isBranchless: false,
    connectedTools: { linear: false, gitlab: false, jira: false, slack: false },
  });
  h.summaries = {};
  h.queueRows = [];
  h.threadId = null;
  h.branchPrs = [];
  h.mergedMounts = new Set();
  h.diffStats = new Map();
  h.statuses = new Map();
  cancelCurrentTurn.mockResolvedValue(undefined);
  recoverStuckStep.mockResolvedValue(undefined);
  selectSessionPr.mockResolvedValue(undefined);
  h.revealMirror.mockResolvedValue(undefined);
  h.locateMirror.mockResolvedValue({ path: '/mirror/harborline/plan' });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

type Setup = {
  readonly crumbs: ReadonlyArray<string>;
  readonly activeLens?: Parameters<typeof useTrailMenus>[0]['activeLens'];
  readonly isBranchless?: boolean;
};

const menusFor = ({ crumbs, activeLens = null, isBranchless = false }: Setup) =>
  renderHook(() => useTrailMenus({ session, crumbs: crumbs.map(crumb), activeLens, isBranchless }))
    .result.current;

const menuOf = (setup: Setup, crumbId: string): CrumbMenuModel => {
  const menu = menusFor(setup).get(crumbId);
  if (menu === undefined) {
    throw new Error(`no menu for ${crumbId}`);
  }
  return menu;
};

const rowsOf = (menu: CrumbMenuModel): ReadonlyArray<CrumbMenuRow> =>
  menu.groups.flatMap((group) => group.rows);

const rowIds = (menu: CrumbMenuModel) => rowsOf(menu).map((row) => row.id);

const actionOf = (menu: CrumbMenuModel, id: string): CrumbMenuAction => {
  const found = menu.actions.find((action) => action.id === id);
  if (found === undefined) {
    throw new Error(`no action ${id}`);
  }
  return found;
};

const actionIds = (menu: CrumbMenuModel) => menu.actions.map((action) => action.id);

const rowById = (menu: CrumbMenuModel, id: string): CrumbMenuRow => {
  const found = rowsOf(menu).find((row) => row.id === id);
  if (found === undefined) {
    throw new Error(`no row ${id}`);
  }
  return found;
};

const labelsOf = (menu: CrumbMenuModel) => menu.actions.map((action) => [action.id, action.label]);

const instantFrames = () =>
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 0;
  });

const listenTo = (name: string) => {
  const events: Array<CustomEvent> = [];
  const listener = (event: Event) => events.push(event as CustomEvent);
  window.addEventListener(name, listener);
  return { events, stop: () => window.removeEventListener(name, listener) };
};

const runPage = { crumbs: ['overview', 'lens-page', 'workflow-run'] };
const anyPage = (activeLens: Setup['activeLens']): Setup => ({
  crumbs: ['overview', 'x'],
  activeLens,
});

describe('useTrailMenus page crumb', () => {
  it('puts the page switcher on the depth one crumb only', () => {
    const menus = menusFor({ crumbs: ['overview', 'lens-agents', 'selected-child'] });
    expect([...menus.keys()]).toEqual(['lens-agents']);
    const lone = menusFor({ crumbs: ['overview'] });
    expect([...lone.keys()]).toEqual(['overview']);
  });

  it('puts the branch switcher, not the page switcher, on the Branch crumb', () => {
    h.state.sessionProjectMounts = { [SESSION_ID]: [mount('ledger-core', 'ak/feat-ledger')] };
    const menus = menusFor({ crumbs: ['overview', 'branch'] });
    expect([...menus.keys()]).toEqual(['branch']);
    expect(rowIds(menus.get('branch') as CrumbMenuModel)).toEqual(['/work/ledger-core']);
  });

  it('carries the session title, the open lens and the summaries', () => {
    h.summaries = { agents: '3 agents' };
    const menu = menuOf(
      { crumbs: ['overview', 'lens-agents'], activeLens: 'agents' },
      'lens-agents',
    );
    expect(menu.context).toBe('Fix ledger');
    expect(rowById(menu, 'agents').isCurrent).toBe(true);
    expect(rowById(menu, 'overview').isCurrent).toBe(false);
    expect(rowById(menu, 'agents').metaA).toBe('3 agents');
  });

  it('offers the action of the open page and none on overview', () => {
    expect(labelsOf(menuOf(anyPage('agents'), 'x'))).toEqual([['start-agent', 'Start agent']]);
    expect(labelsOf(menuOf(anyPage('workflows'), 'x'))).toEqual([
      ['start-workflow', 'Start a workflow'],
    ]);
    expect(labelsOf(menuOf(anyPage('plans'), 'x'))).toEqual([['new-artifact', 'New artifact']]);
    expect(actionIds(menuOf(anyPage(null), 'x'))).toEqual([]);
    expect(actionIds(menuOf(anyPage('review'), 'x'))).toEqual([]);
  });

  it('clears the focused run and artifact when a page is picked', () => {
    const menu = menuOf(anyPage('agents'), 'x');
    rowById(menu, 'workflows').onSelect();
    expect(setFocusedArtifactId).toHaveBeenCalledWith(SESSION_ID, null);
    expect(setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, null);
    expect(h.openLens).toHaveBeenCalledWith({ sessionId: SESSION_ID, lens: 'workflows' });
    rowById(menu, 'overview').onSelect();
    expect(h.openLens).toHaveBeenLastCalledWith({ sessionId: SESSION_ID, lens: null });
  });

  it('start agent opens the agents lens, then fires the create event on the next frame', () => {
    const frames = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    const created = listenTo(createAgentEventName(SESSION_ID));
    actionOf(menuOf(anyPage('agents'), 'x'), 'start-agent').onRun();
    expect(h.openLens).toHaveBeenCalledWith({ sessionId: SESSION_ID, lens: 'agents' });
    expect(created.events).toHaveLength(0);
    const frame = frames.mock.calls[0]?.[0] as FrameRequestCallback;
    frame(0);
    created.stop();
    expect(created.events).toHaveLength(1);
  });

  it('start a workflow fires the builder event with the session', () => {
    const opened = listenTo('goodboy:open-workflow-builder');
    actionOf(menuOf(anyPage('workflows'), 'x'), 'start-workflow').onRun();
    opened.stop();
    expect(opened.events.map((event) => event.detail)).toEqual([{ sessionId: SESSION_ID }]);
  });

  it('new artifact clears the focus, opens plans, then fires the new artifact event', () => {
    instantFrames();
    const fired = vi.fn();
    const plans = menuOf(anyPage('plans'), 'x');
    const eventName = `goodboy:open-new-artifact:${SESSION_ID}`;
    window.addEventListener(eventName, fired);
    actionOf(plans, 'new-artifact').onRun();
    window.removeEventListener(eventName, fired);
    expect(setFocusedArtifactId).toHaveBeenCalledWith(SESSION_ID, null);
    expect(h.openLens).toHaveBeenCalledWith({ sessionId: SESSION_ID, lens: 'plans' });
    expect(fired).toHaveBeenCalledTimes(1);
  });
});

describe('useTrailMenus workflow run crumb', () => {
  beforeEach(() => {
    h.attachedRuns = [
      { run, workflow },
      { run: runTwo, workflow },
    ];
  });

  it('lists every attached run under the run crumb and marks the selected one', () => {
    h.selectedRun = { run, workflow };
    const menu = menuOf(runPage, 'workflow-run');
    expect(rowIds(menu)).toEqual(['run-1', 'run-2']);
    expect(rowById(menu, 'run-1').label).toBe('Refactor ledger');
    expect(rowById(menu, 'run-2').label).toBe('Refactor');
    expect(rowById(menu, 'run-1').isCurrent).toBe(true);
    expect(rowById(menu, 'run-2').isCurrent).toBe(false);
  });

  it('prefers the selected run over the focused one', () => {
    h.selectedRun = { run, workflow };
    h.state.focusedWorkflowRunId = { [SESSION_ID]: 'run-2' };
    const menu = menuOf(runPage, 'workflow-run');
    expect(rowById(menu, 'run-1').isCurrent).toBe(true);
    expect(rowById(menu, 'run-2').isCurrent).toBe(false);
  });

  it('falls back to the focused run when none is selected', () => {
    h.state.focusedWorkflowRunId = { [SESSION_ID]: 'run-2' };
    const menu = menuOf(runPage, 'workflow-run');
    expect(rowById(menu, 'run-2').isCurrent).toBe(true);
    expect(rowById(menu, 'run-1').isCurrent).toBe(false);
  });

  it('has no run menu without an attached run', () => {
    h.attachedRuns = [];
    expect(menusFor(runPage).has('workflow-run')).toBe(false);
  });

  it('marks a run finished when every step of the workflow is done', () => {
    h.state.sessionPhaseRuns = {
      [SESSION_ID]: [stepOne, { ...stepTwo, status: 'completed' }],
    };
    const menu = menuOf(runPage, 'workflow-run');
    expect(rowById(menu, 'run-1').state?.word).toBe('Done');
    expect(rowById(menu, 'run-2').state?.word).toBe('Waiting');
  });

  it('marks a run with a failed step as needing you', () => {
    const menu = menuOf(runPage, 'workflow-run');
    expect(rowById(menu, 'run-1').state?.word).toBe('Needs you');
  });

  it('offers start a workflow and focuses the run on select', () => {
    const menu = menuOf(runPage, 'workflow-run');
    expect(actionIds(menu)).toEqual(['start-workflow']);
    rowById(menu, 'run-2').onSelect();
    expect(setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, 'run-2');
    expect(h.openLens).toHaveBeenCalledWith({ sessionId: SESSION_ID, lens: 'workflows' });
  });
});

describe('useTrailMenus pull request crumb', () => {
  const prPage = { crumbs: ['overview', 'lens-page', 'pr-number'] };

  it('has no menu without a pull request', () => {
    expect(menusFor(prPage).has('pr-number')).toBe(false);
  });

  it('lists the branch pull requests and marks the selected number', () => {
    h.branchPrs = [pr(41, 'Ledger fix'), pr(42, 'Notify fix')];
    h.state.sessionSelectedPrNumber = { [SESSION_ID]: 42 };
    h.state.sessionGithub = { [SESSION_ID]: { pr: pr(41, 'Ledger fix') } };
    const menu = menuOf(prPage, 'pr-number');
    expect(rowIds(menu)).toEqual(['41', '42']);
    expect(rowById(menu, '42').isCurrent).toBe(true);
    expect(rowById(menu, '41').isCurrent).toBe(false);
  });

  it('falls back to the session pull request and its number', () => {
    h.state.sessionGithub = { [SESSION_ID]: { pr: pr(41, 'Ledger fix') } };
    const menu = menuOf(prPage, 'pr-number');
    expect(rowIds(menu)).toEqual(['41']);
    expect(rowById(menu, '41').isCurrent).toBe(true);
  });

  it('creates a pull request from the action and selects one from a row', () => {
    h.branchPrs = [pr(41, 'Ledger fix')];
    const menu = menuOf(prPage, 'pr-number');
    expect(labelsOf(menu)).toEqual([['new-pull-request', 'New pull request']]);
    actionOf(menu, 'new-pull-request').onRun();
    expect(setPullRequestMode).toHaveBeenCalledWith({ sessionId: SESSION_ID, mode: 'create_pr' });
    expect(h.openLens).toHaveBeenCalledWith({ sessionId: SESSION_ID, lens: 'pr' });
    rowById(menu, '41').onSelect();
    expect(setPullRequestMode).toHaveBeenLastCalledWith({
      sessionId: SESSION_ID,
      mode: 'overview',
    });
    expect(selectSessionPr).toHaveBeenCalledWith(SESSION_ID, 41);
  });
});

describe('useTrailMenus review thread crumb', () => {
  const threadPage = { crumbs: ['overview', 'lens-page', 'review-thread'] };

  beforeEach(() => {
    h.queueRows = [
      queueRow('thread-1'),
      queueRow('thread-2', { status: 'resolved', attempt: { agentId: 'agent-other' } }),
    ];
    h.threadId = 'thread-1';
    h.state.selectedAgentId = { [SESSION_ID]: scout.id };
    h.state.sessionGithub = { [SESSION_ID]: { pr: pr(41, 'Ledger fix') } };
  });

  it('lists the conversations and names the pull request', () => {
    const menu = menuOf(threadPage, 'review-thread');
    expect(menu.context).toBe('#41');
    expect(rowIds(menu)).toEqual(['thread-1', 'thread-2']);
    expect(rowById(menu, 'thread-1').isCurrent).toBe(true);
    expect(rowById(menu, 'thread-1').label).toBe('Rename thread-1');
  });

  it('offers open on GitHub and copy link for the open thread url', () => {
    const menu = menuOf(threadPage, 'review-thread');
    expect(labelsOf(menu)).toEqual([
      ['open-github', 'Open on GitHub'],
      ['copy-link', 'Copy link'],
    ]);
    actionOf(menu, 'open-github').onRun();
    expect(h.openUrl).toHaveBeenCalledWith('https://example.test/thread-1');
    actionOf(menu, 'copy-link').onRun();
    expect(h.copy).toHaveBeenCalledWith({ text: 'https://example.test/thread-1' });
  });

  it('offers no action when the thread has no url', () => {
    h.queueRows = [queueRow('thread-1', { commentThread: null })];
    expect(actionIds(menuOf(threadPage, 'review-thread'))).toEqual([]);
  });

  it('opens the resolver page of a thread with an attempt, the Branch otherwise', () => {
    const menu = menuOf(threadPage, 'review-thread');
    rowById(menu, 'thread-2').onSelect();
    expect(navigate).toHaveBeenLastCalledWith({
      to: {
        at: 'session',
        sessionId: SESSION_ID,
        view: {
          lens: 'review',
          agentId: 'agent-other',
          studio: null,
          target: { kind: 'thread', threadId: 'thread-2' },
        },
      },
    });
    rowById(menu, 'thread-1').onSelect();
    expect(navigate).toHaveBeenLastCalledWith({
      to: branchPlace({ sessionId: SESSION_ID, threadId: 'thread-1' }),
      mode: 'replace',
    });
  });
});

describe('useTrailMenus resolver attempts', () => {
  const resolverPage = { crumbs: ['overview', 'lens-page', 'selected-child'] };

  beforeEach(() => {
    h.state.selectedAgentId = { [SESSION_ID]: resolver.id };
    h.threadId = 'thread-1';
    h.queueRows = [queueRow('thread-1')];
    h.state.sessionResolveAttempts = {
      [SESSION_ID]: [
        attempt({ id: 'attempt-1', createdAt: 1_000 }),
        attempt({ id: 'attempt-2', createdAt: 2_000, agentId: 'agent-other' as AgentId }),
        attempt({ id: 'attempt-3', threadIds: ['thread-9'] }),
      ],
    };
  });

  it('lists the attempts on the open comment, newest first', () => {
    const menu = menuOf(resolverPage, 'selected-child');
    expect(rowIds(menu)).toEqual(['attempt-2', 'attempt-1']);
    expect(rowById(menu, 'attempt-1').isCurrent).toBe(true);
    expect(rowById(menu, 'attempt-2').isCurrent).toBe(false);
    expect(menu.context).toBe('ledger.ts:12');
  });

  it('offers resolve again with the reread instruction once no attempt is live', () => {
    const menu = menuOf(resolverPage, 'selected-child');
    expect(actionIds(menu)).toEqual(['resolve-again']);
    actionOf(menu, 'resolve-again').onRun();
    expect(h.resolveAgain).toHaveBeenCalledTimes(1);
    const call = h.resolveAgain.mock.calls[0]?.[0] as { threadId: string; instruction: string };
    expect(call.threadId).toBe('thread-1');
    expect(call.instruction.length).toBeGreaterThan(0);
  });

  it('hides resolve again while an attempt is running', () => {
    h.state.sessionResolveAttempts = {
      [SESSION_ID]: [attempt({ id: 'attempt-1', phase: 'running' })],
    };
    expect(actionIds(menuOf(resolverPage, 'selected-child'))).toEqual([]);
  });

  it('opens the resolver page of the attempt agent on select', () => {
    const menu = menuOf(resolverPage, 'selected-child');
    rowById(menu, 'attempt-2').onSelect();
    expect(navigate).toHaveBeenCalledWith({
      to: {
        at: 'session',
        sessionId: SESSION_ID,
        view: {
          lens: 'review',
          agentId: 'agent-other',
          studio: null,
          target: { kind: 'thread', threadId: 'thread-1' },
        },
      },
    });
  });

  it('falls back to Comment when the thread row is gone', () => {
    h.queueRows = [];
    expect(menuOf(resolverPage, 'selected-child').context).toBe('Comment');
  });

  it('has no menu for a resolver without an open thread', () => {
    h.threadId = null;
    expect(menusFor(resolverPage).has('selected-child')).toBe(false);
  });
});

describe('useTrailMenus diff branch crumb', () => {
  const branchPage = { crumbs: ['overview', 'lens-page', 'branch'] };

  beforeEach(() => {
    h.state.sessionProjectMounts = {
      [SESSION_ID]: [
        mount('ledger-core', 'ak/feat-ledger'),
        mount('notify-relay', 'ak/feat-notify'),
      ],
    };
  });

  it('lists the mounts and marks the requested one', () => {
    h.state.diffMountPath = { [SESSION_ID]: '/work/notify-relay' };
    const menu = menuOf(branchPage, 'branch');
    expect(rowIds(menu)).toEqual(['/work/ledger-core', '/work/notify-relay']);
    expect(rowById(menu, '/work/notify-relay').isCurrent).toBe(true);
    expect(rowById(menu, '/work/ledger-core').isCurrent).toBe(false);
  });

  it('feeds the stats and the merged requests to the rows', () => {
    h.diffStats = new Map([['/work/ledger-core', { additions: 3, deletions: 1 }]]);
    h.mergedMounts = new Set(['mount-notify-relay']);
    h.statuses = new Map([
      [
        '/work/notify-relay',
        {
          branch: 'ak/feat-notify',
          upstream: 'origin/ak/feat-notify',
          upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
          mainDistance: { kind: 'known', ahead: 1, behind: 0 },
          workingTree: {
            kind: 'known',
            staged: 0,
            unstaged: 0,
            untracked: 0,
            unmerged: 0,
            changed: 0,
          },
          inProgress: null,
        },
      ],
    ]);
    const menu = menuOf(branchPage, 'branch');
    expect(rowById(menu, '/work/ledger-core').metaA).not.toBeNull();
    expect(rowById(menu, '/work/notify-relay').metaA).toBeNull();
    expect(rowById(menu, '/work/notify-relay').state?.word).toBe('Merged');
    expect(rowById(menu, '/work/ledger-core').state).toBeNull();
  });

  it('offers all branches in Session and opens the diff of a picked mount', () => {
    const menu = menuOf(branchPage, 'branch');
    expect(labelsOf(menu)).toEqual([['all-branches', 'All branches in Session']]);
    actionOf(menu, 'all-branches').onRun();
    expect(h.openLens).toHaveBeenCalledWith({ sessionId: SESSION_ID, lens: null });
    rowById(menu, '/work/notify-relay').onSelect();
    expect(navigate).toHaveBeenLastCalledWith({
      to: branchPlace({ sessionId: SESSION_ID, mountPath: '/work/notify-relay', tab: 'comments' }),
      mode: 'replace',
    });
  });
});

describe('useTrailMenus artifact crumb', () => {
  const artifactPage = { crumbs: ['overview', 'lens-page', 'artifact'] };

  beforeEach(() => {
    h.state.sessionArtifacts = {
      [SESSION_ID]: [
        artifact({ id: 'artifact-1' as ArtifactId, kind: 'plan', agentId: implementer.id }),
        artifact({ id: 'artifact-2' as ArtifactId, kind: 'report' }),
        artifact({ id: 'artifact-3' as ArtifactId, kind: 'plan', status: 'discarded' }),
      ],
    };
    h.state.focusedArtifactId = { [SESSION_ID]: 'artifact-1' };
  });

  it('has no menu without artifacts', () => {
    h.state.sessionArtifacts = {};
    expect(menusFor(artifactPage).has('artifact')).toBe(false);
  });

  it('lists the live artifacts, marks the focused one and names the author role', () => {
    const menu = menuOf(artifactPage, 'artifact');
    expect(rowIds(menu)).toEqual(['artifact-1', 'artifact-2']);
    expect(rowById(menu, 'artifact-1').isCurrent).toBe(true);
    expect(rowById(menu, 'artifact-1').secondary).toBe('Implementer');
    expect(rowById(menu, 'artifact-2').secondary).toBeNull();
  });

  it('offers the saved copy actions for the focused artifact only', () => {
    const menu = menuOf(artifactPage, 'artifact');
    expect(labelsOf(menu)).toEqual([
      ['reveal-saved-copy', 'Show saved copy'],
      ['copy-saved-path', 'Copy folder path'],
    ]);
    h.state.focusedArtifactId = {};
    expect(actionIds(menuOf(artifactPage, 'artifact'))).toEqual([]);
  });

  it('reveals the saved copy in the workspace folder and reports a failure', async () => {
    const menu = menuOf(artifactPage, 'artifact');
    const reveal = menu.actions[0] as CrumbMenuAction;
    reveal.onRun();
    expect(h.revealMirror).toHaveBeenCalledTimes(1);
    const call = h.revealMirror.mock.calls[0]?.[0] as { workspaceSlug: string; folder: string };
    expect(call.workspaceSlug).toBe('harborline');
    expect(call.folder.length).toBeGreaterThan(0);
    h.revealMirror.mockRejectedValueOnce(new Error('nope'));
    reveal.onRun();
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({
      title: "Couldn't show the saved copy",
      sessionId: SESSION_ID,
    });
  });

  it('copies the saved path and reports a failure', async () => {
    const menu = menuOf(artifactPage, 'artifact');
    const copyPath = menu.actions[1] as CrumbMenuAction;
    copyPath.onRun();
    await vi.waitFor(() =>
      expect(h.copy).toHaveBeenCalledWith({ text: '/mirror/harborline/plan' }),
    );
    h.locateMirror.mockRejectedValueOnce(new Error('nope'));
    copyPath.onRun();
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({
      title: "Couldn't copy the path",
      sessionId: SESSION_ID,
    });
  });

  it('offers no saved copy action when the session has no workspace', () => {
    h.state.workspaces = [];
    expect(actionIds(menuOf(artifactPage, 'artifact'))).toEqual([]);
  });

  it('focuses the picked artifact and opens plans', () => {
    const menu = menuOf(artifactPage, 'artifact');
    rowById(menu, 'artifact-2').onSelect();
    expect(setFocusedArtifactId).toHaveBeenCalledWith(SESSION_ID, 'artifact-2');
    expect(h.openLens).toHaveBeenCalledWith({ sessionId: SESSION_ID, lens: 'plans' });
  });
});

describe('useTrailMenus agent crumbs', () => {
  const agentPage = { crumbs: ['overview', 'lens-agents', 'selected-child'] };
  const stepPage = { crumbs: ['overview', 'lens-page', 'selected-child'] };

  it('gives the selected agent a sibling menu with the state word of each peer', () => {
    h.state.selectedAgentId = { [SESSION_ID]: scout.id };
    h.signals = { openQuestionAgentIds: new Set([scout.id]), liveTurnAgentIds: new Set() };
    const menu = menuOf(agentPage, 'selected-child');
    expect(rowIds(menu)).toEqual(expect.arrayContaining([scout.id, implementer.id]));
    expect(rowIds(menu)).not.toContain(resolver.id);
    expect(rowIds(menu)).not.toContain(stepOne.id);
    expect(rowById(menu, scout.id).isCurrent).toBe(true);
    expect(rowById(menu, scout.id).state?.word).toBe('Needs you');
    expect(rowById(menu, implementer.id).state?.word).toBe('Running');
    expect(rowById(menu, implementer.id).metaA).toBeNull();
  });

  it('offers start agent on a top level agent and selects a peer', () => {
    h.state.selectedAgentId = { [SESSION_ID]: scout.id };
    const menu = menuOf(agentPage, 'selected-child');
    expect(actionIds(menu)).toEqual(['start-agent']);
    rowById(menu, implementer.id).onSelect();
    expect(navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: implementer.id },
    });
  });

  it('scopes a child menu to its siblings of the same kind and drops start agent', () => {
    const sibling = agent({
      id: 'agent-sibling' as AgentId,
      name: 'area beta',
      kind: 'implementer',
      ordinal: 6,
      parentAgentId: stepOne.id,
      workflowRunId: RUN_ID,
    });
    const scoutSibling = agent({
      id: 'agent-scout-sibling' as AgentId,
      kind: 'scout',
      ordinal: 7,
      parentAgentId: stepOne.id,
      workflowRunId: RUN_ID,
    });
    h.state.sessionPhaseRuns = {
      [SESSION_ID]: [stepOne, stepTwo, child, sibling, scoutSibling],
    };
    h.state.selectedAgentId = { [SESSION_ID]: child.id };
    h.attachedRuns = [{ run, workflow }];
    const menu = menuOf(stepPage, 'selected-child');
    expect([...rowIds(menu)].sort()).toEqual([child.id, sibling.id].sort());
    expect(actionIds(menu)).toEqual([]);
  });

  it('gives a workflow step the step menu of its run with retry', () => {
    h.state.selectedAgentId = { [SESSION_ID]: stepTwo.id };
    h.attachedRuns = [{ run, workflow }];
    const menu = menuOf(stepPage, 'selected-child');
    expect(menu.title).toBe('Steps');
    expect(menu.context).toBe('Refactor ledger');
    expect(rowIds(menu)).toEqual(['step-1', 'step-2']);
    expect(rowById(menu, 'step-2').isCurrent).toBe(true);
    expect(rowById(menu, 'step-1').secondary).toBe('Generalist');
    expect(rowById(menu, 'step-2').metaA).toBe('opus');
    expect(rowById(menu, 'step-1').metaA).toBe('Auto');
    expect(actionIds(menu)).toEqual(['retry-step']);
    actionOf(menu, 'retry-step').onRun();
    expect(recoverStuckStep).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      workflowRunId: 'run-1',
    });
    rowById(menu, 'step-1').onSelect();
    expect(navigate).toHaveBeenLastCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: stepOne.id },
    });
  });

  it('reports a failed retry', async () => {
    h.state.selectedAgentId = { [SESSION_ID]: stepTwo.id };
    h.attachedRuns = [{ run, workflow }];
    recoverStuckStep.mockRejectedValueOnce(new Error('nope'));
    const menu = menuOf(stepPage, 'selected-child');
    actionOf(menu, 'retry-step').onRun();
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({
      title: "Couldn't retry the step",
      sessionId: SESSION_ID,
    });
  });

  it('offers stop on a running step, asks to confirm and cancels the turn', () => {
    const running: Agent = { ...stepTwo, status: 'running' };
    h.state.sessionPhaseRuns = { [SESSION_ID]: [stepOne, running] };
    h.state.selectedAgentId = { [SESSION_ID]: running.id };
    h.attachedRuns = [{ run, workflow }];
    const menu = menuOf(stepPage, 'selected-child');
    expect(actionIds(menu)).toEqual(['stop']);
    const stop = actionOf(menu, 'stop');
    expect(stop.label).toBe('Stop this step');
    expect(stop.confirm).toEqual({
      title: `Stop ${running.name}?`,
      description: 'The edits it made so far stay in the branch. Later steps wait for you.',
      confirmLabel: 'Stop step',
    });
    stop.onRun();
    expect(cancelCurrentTurn).toHaveBeenCalledWith(SESSION_ID, running.id, 'user');
  });

  it('offers stop and no retry on a failed step whose turn is live', () => {
    h.state.selectedAgentId = { [SESSION_ID]: stepTwo.id };
    h.attachedRuns = [{ run, workflow }];
    h.signals = { openQuestionAgentIds: new Set(), liveTurnAgentIds: new Set([stepTwo.id]) };
    expect(actionIds(menuOf(stepPage, 'selected-child'))).toEqual(['stop']);
  });

  it('has no menu for a step whose run is not attached', () => {
    h.state.selectedAgentId = { [SESSION_ID]: stepTwo.id };
    h.attachedRuns = [];
    expect(menusFor(stepPage).has('selected-child')).toBe(false);
  });

  it('keeps the sibling menu for a plain agent even when a thread is open', () => {
    h.state.selectedAgentId = { [SESSION_ID]: scout.id };
    h.threadId = 'thread-1';
    h.queueRows = [queueRow('thread-1')];
    const menu = menuOf(agentPage, 'selected-child');
    expect(rowIds(menu)).toContain(scout.id);
    expect(menu.title).not.toBe('Attempts');
  });

  it('has no sibling menu for a resolver without a thread', () => {
    h.state.selectedAgentId = { [SESSION_ID]: resolver.id };
    h.threadId = null;
    expect(menusFor(stepPage).has('selected-child')).toBe(false);
  });

  it('maps the parent and root crumbs to the parent and root agents', () => {
    const grandChild = agent({
      id: 'agent-grand' as AgentId,
      name: 'leaf',
      kind: 'implementer',
      ordinal: 8,
      parentAgentId: child.id,
      workflowRunId: RUN_ID,
    });
    h.state.sessionPhaseRuns = { [SESSION_ID]: [stepOne, stepTwo, child, grandChild] };
    h.state.selectedAgentId = { [SESSION_ID]: grandChild.id };
    h.attachedRuns = [{ run, workflow }];
    const menus = menusFor({
      crumbs: ['overview', 'lens-page', 'selected-root', 'selected-parent', 'selected-child'],
    });
    const root = menus.get('selected-root') as CrumbMenuModel;
    expect(root.title).toBe('Steps');
    expect(rowById(root, 'step-1').isCurrent).toBe(true);
    expect(rowIds(menus.get('selected-parent') as CrumbMenuModel)).toEqual([child.id]);
    expect(rowIds(menus.get('selected-child') as CrumbMenuModel)).toEqual([grandChild.id]);
  });
});

describe('createAgentEventName', () => {
  it('scopes the event to the session', () => {
    expect(createAgentEventName(SESSION_ID)).toBe('goodboy:open-create-agent:session-1');
  });
});
