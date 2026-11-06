// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type Agent,
  type IsoDateTime,
  type ProviderRunId,
  type SessionMountView,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import {
  aNowAgent,
  aNowRun,
  aNowStepAgent,
  aNowWorkflow,
  NOW_SESSION,
  NOW_STARTED_AT,
} from '../../../../central/now/testing/nowModelOf';
import type { AttachedRun } from '../../../../../workflows/activeWorkflowRuns';
import { aMountView } from '../../../../testing/aMountView';
import { NAMES } from '../../../../../../shared/utils/names';
import { sessionRunsOf } from '../../../../sessionRunsOf';
import { VISIBLE_FINISHED_COUNT } from '../../../../finishedRunsCap';
import { sessionPlace } from '../../../../../../store/slices/navigation/place';
import { RunsGrid } from './index';

const session = aSession({ id: NOW_SESSION });

const BLOCKED = {
  kind: 'blocked',
  runId: brandId<ProviderRunId>({ value: 'run-harborline' }),
  blockedAt: NOW_STARTED_AT,
} as const;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  localStorage.clear();
  await resetStoryStore();
});

afterEach(cleanup);

type RunsParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly blockedIds?: ReadonlyArray<string>;
  readonly attached?: ReadonlyArray<AttachedRun>;
  readonly mounts?: ReadonlyArray<SessionMountView>;
};

const runsOf = ({ agents, blockedIds = [], attached = [], mounts = [] }: RunsParams) =>
  sessionRunsOf({
    attachedRuns: attached,
    agents,
    kindOverride: {},
    autoViews: [],
    orchestrating: {},
    questions: [],
    rootTurns: {},
    turnByAgentId: new Map(blockedIds.map((id) => [id, BLOCKED])),
    revisingStarts: {},
    mounts,
    projects: [],
  });

type GridParams = {
  readonly runs: ReturnType<typeof runsOf>;
};

const renderGrid = ({ runs }: GridParams) =>
  render(
    <ToastProvider>
      <RunsGrid session={session} runs={runs} />
    </ToastProvider>,
  );

describe('RunsGrid', () => {
  it('names what needs you in its own group and lists it first', () => {
    const agents = [
      aNowAgent({ key: 'runner', name: 'Runner', status: 'running' }),
      aNowAgent({ key: 'asker', name: 'Asker', status: 'running' }),
    ];

    renderGrid({ runs: runsOf({ agents, blockedIds: ['agent-asker'] }) });

    const needsYou = screen.getByRole('list', { name: 'Needs you' });
    const running = screen.getByRole('list', { name: 'Running' });
    within(needsYou).getByRole('button', { name: 'Open Asker, Agent, Needs permission' });
    within(running).getByRole('button', { name: 'Open Runner, Agent, Running' });
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Needs you', 'Running']);
  });

  it('reads the planner elapsed time in the time column while the plan is revised', () => {
    const agents = [aNowAgent({ key: 'planner', name: 'Planner', status: 'running' })];
    const runs = runsOf({ agents }).map((run) => ({
      ...run,
      revisingSince: Date.now() - 125_000,
    }));

    renderGrid({ runs });

    const row = screen.getByRole('button', { name: /Open Planner/ });
    expect(row.textContent).toContain('2m');
    expect(row.textContent).not.toContain('ago');
  });

  it('marks a finished agent with an unread reply in the title, never with a dot', () => {
    const unread: Agent = {
      ...aNowAgent({ key: 'reviewer', name: 'Reviewer', status: 'completed' }),
      lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-13T12:10:00.000Z' }),
    };

    renderGrid({ runs: runsOf({ agents: [unread] }) });

    expect(screen.queryByRole('img', { name: 'Unread' })).toBeNull();
    const row = screen.getByRole('button', { name: /Open Reviewer.*unread/ });
  });

  it('files stopped agents under Idle as Stopped and resumes them together', async () => {
    const resumeStoppedAgents = vi.fn(async () => 2);
    useAppStore.setState({ resumeStoppedAgents });
    const agents = [
      aNowAgent({ key: 'first', name: 'First', status: 'stopped', stoppedBy: 'app' }),
      aNowAgent({ key: 'second', name: 'Second', status: 'stopped', stoppedBy: 'app' }),
    ];

    renderGrid({ runs: runsOf({ agents }) });

    const group = screen.getByRole('list', { name: 'Idle' });
    expect(within(group).getAllByRole('button', { name: /, Stopped$/ })).toHaveLength(2);
    expect(screen.queryByRole('list', { name: 'Finished' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue all' }));
    await waitFor(() =>
      expect(resumeStoppedAgents).toHaveBeenCalledWith({ sessionId: NOW_SESSION }),
    );
  });

  it('offers no Continue all for a single stopped agent', () => {
    const agents = [aNowAgent({ key: 'only', name: 'Only', status: 'stopped', stoppedBy: 'app' })];

    renderGrid({ runs: runsOf({ agents }) });

    expect(screen.queryByRole('button', { name: 'Continue all' })).toBeNull();
  });

  it('stops every running agent from the header and says how many stopped', async () => {
    const cancelTurnConfirmed = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'exited', exitedAt: null })
      .mockResolvedValueOnce({ outcome: 'still_running', exitedAt: null });
    const agents = [
      aNowAgent({ key: 'first', name: 'First', status: 'running' }),
      aNowAgent({ key: 'second', name: 'Second', status: 'running' }),
    ];
    useAppStore.setState({
      sessionPhaseRuns: { [NOW_SESSION]: agents },
      agentTurnState: Object.fromEntries(
        agents.map((agent) => [
          agent.id,
          {
            kind: 'running',
            runId: brandId<ProviderRunId>({ value: `run-${agent.id}` }),
            startedAt: NOW_STARTED_AT,
          },
        ]),
      ),
      cancelTurnConfirmed,
    });

    renderGrid({ runs: runsOf({ agents }) });
    fireEvent.click(screen.getByRole('button', { name: 'Stop all (2)' }));

    await screen.findByText('Stopped 1, 1 still running');
    expect(cancelTurnConfirmed).toHaveBeenCalledTimes(2);
    expect(cancelTurnConfirmed).toHaveBeenCalledWith({
      sessionId: NOW_SESSION,
      agentId: agents[0]?.id,
      reason: 'user',
    });
  });

  it('offers no Stop all for a single running agent', () => {
    const agents = [aNowAgent({ key: 'only', name: 'Only', status: 'running' })];
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: agents } });

    renderGrid({ runs: runsOf({ agents }) });

    expect(screen.queryByRole('button', { name: /^Stop all/ })).toBeNull();
  });

  it('names the model and its effort on the row of an agent run, never the routing id', () => {
    const agent: Agent = {
      ...aNowAgent({ key: 'impl', name: 'Implement the retry cap', status: 'running' }),
      providerOverride: 'anthropic',
      modelOverride: 'sonnet-5.5',
      effort: 'high',
    };
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: [agent] } });

    renderGrid({ runs: runsOf({ agents: [agent] }) });

    const row = screen.getByRole('button', { name: /^Open Implement the retry cap/ });
    const line = row.querySelector('[data-model-line]');
    expect(line?.textContent).toBe('Sonnet 5.5 High');
    expect(row.textContent).not.toContain('sonnet-5.5');
  });

  it('opens an Auto row on its page and opens no tool beside it', async () => {
    const agents = [aNowAgent({ key: 'auto', name: 'Add the retry banner', status: 'running' })];
    useAppStore.setState({
      sessionPhaseRuns: { [NOW_SESSION]: agents },
      currentSessionId: NOW_SESSION,
      drawer: null,
    });
    const runs = runsOf({ agents }).map((run) =>
      run.open.kind === 'agent' ? { ...run, open: { ...run.open, kind: 'auto' as const } } : run,
    );

    renderGrid({ runs });
    fireEvent.click(screen.getByRole('button', { name: /^Open Add the retry banner/ }));

    await waitFor(() =>
      expect(useAppStore.getState().selectedAgentId[NOW_SESSION]).toBe(agents[0]?.id),
    );
    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('unfolds Earlier and scrolls Back to a row the page was left from below the cap', async () => {
    const agents = Array.from({ length: VISIBLE_FINISHED_COUNT + 2 }, (_, index) =>
      aNowAgent({ key: `done-${index}`, name: `Done ${index}`, status: 'completed' }),
    );
    const runs = runsOf({ agents });
    const earlier = runs.filter((run) => run.isFinished).at(-1);
    useAppStore.setState({
      currentWorkspaceId: session.workspaceId,
      sessions: [session],
      sessionPhaseRuns: { [NOW_SESSION]: agents },
    });
    useAppStore
      .getState()
      .navigate({ to: sessionPlace({ sessionId: NOW_SESSION, lens: 'workflows' }) });
    useAppStore.getState().amendFocus({
      patch: {
        scroll: { runs: runs.length - 1 },
        returnRows: { runs: earlier?.id ?? '' },
      },
    });
    const scrolled = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrolled;

    renderGrid({ runs });

    await waitFor(() => expect(scrolled).toHaveBeenCalledOnce());
    expect(scrolled.mock.contexts[0]).toBe(
      document.querySelector(`[data-row-key="${earlier?.id ?? ''}"]`),
    );
    screen.getByRole('button', { name: 'Show fewer' });
  });

  it('keeps the model column out when no run has a model', () => {
    const agents = [aNowAgent({ key: 'only', name: 'Only', status: 'running' })];
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: agents } });

    renderGrid({ runs: runsOf({ agents }) });

    expect(document.querySelector('[data-list-grid-cell="model"]')).toBeNull();
  });

  it('shows Continue on a stopped agent row and continues that agent', async () => {
    const continueStoppedAgent = vi.fn(async () => undefined);
    useAppStore.setState({ continueStoppedAgent });
    const agents = [aNowAgent({ key: 'halted', name: 'Halted', status: 'stopped' })];

    renderGrid({ runs: runsOf({ agents }) });
    fireEvent.click(screen.getByRole('button', { name: NAMES.continue }));

    await waitFor(() =>
      expect(continueStoppedAgent).toHaveBeenCalledWith({
        sessionId: NOW_SESSION,
        agentId: agents[0]?.id,
      }),
    );
  });

  it('reports a Continue that fails and leaves the row where it was', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      reportError,
      continueStoppedAgent: vi.fn(async () => {
        throw new Error('the provider is gone');
      }),
    });
    const agents = [aNowAgent({ key: 'halted', name: 'Halted', status: 'stopped' })];

    renderGrid({ runs: runsOf({ agents }) });
    fireEvent.click(screen.getByRole('button', { name: NAMES.continue }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't continue the agent" }),
      ),
    );
    screen.getByRole('list', { name: 'Idle' });
  });

  it('gives no Continue to a finished agent', () => {
    const agents = [aNowAgent({ key: 'done', name: 'Done one', status: 'completed' })];

    renderGrid({ runs: runsOf({ agents }) });

    expect(screen.queryByRole('button', { name: NAMES.continue })).toBeNull();
  });

  it('reads a preset run that has not started as Ready with a real Start', async () => {
    const activateWorkflowAgent = vi.fn(async () => undefined);
    useAppStore.setState({ activateWorkflowAgent });
    const preset = aNowRun({
      key: 'preset',
      title: 'Center the profile page',
      workflow: aNowWorkflow({
        key: 'preset',
        name: 'Fix a layout',
        stepNames: ['Find', 'Center'],
      }),
    });
    const agents = [
      aNowStepAgent({ attached: preset, stepIndex: 0, status: 'pending', name: 'Find' }),
      aNowStepAgent({ attached: preset, stepIndex: 1, status: 'pending', name: 'Center' }),
    ];
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: agents } });

    renderGrid({ runs: runsOf({ agents, attached: [preset] }) });

    screen.getByRole('button', { name: 'Open Center the profile page, Workflow, Ready' });
    fireEvent.click(screen.getByRole('button', { name: NAMES.start }));
    await waitFor(() =>
      expect(activateWorkflowAgent).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: NOW_SESSION, agentId: agents[0]?.id }),
      ),
    );
  });

  it('reports a Start that fails', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      reportError,
      activateWorkflowAgent: vi.fn(async () => {
        throw new Error('no worktree');
      }),
    });
    const preset = aNowRun({
      key: 'preset',
      title: 'Center the profile page',
      workflow: aNowWorkflow({ key: 'preset', name: 'Fix a layout', stepNames: ['Find'] }),
    });
    const agents = [
      aNowStepAgent({ attached: preset, stepIndex: 0, status: 'pending', name: 'Find' }),
    ];
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: agents } });

    renderGrid({ runs: runsOf({ agents, attached: [preset] }) });
    fireEvent.click(screen.getByRole('button', { name: NAMES.start }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "The next step didn't start" }),
      ),
    );
  });

  it('keeps Stop all in the page action row when every running agent waits for permission', () => {
    const agents = [
      aNowAgent({ key: 'first', name: 'First', status: 'running' }),
      aNowAgent({ key: 'second', name: 'Second', status: 'running' }),
    ];
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: agents } });

    renderGrid({ runs: runsOf({ agents, blockedIds: ['agent-first', 'agent-second'] }) });

    expect(screen.queryByRole('list', { name: 'Running' })).toBeNull();
    screen.getByRole('list', { name: 'Needs you' });
    const stopAll = screen.getByRole('button', { name: 'Stop all (2)' });
    expect(stopAll.closest('[data-runs-actions]')).not.toBeNull();
  });

  it('offers Connect instead of a Continue that would only fail when the provider is signed out', () => {
    const continueStoppedAgent = vi.fn(async () => undefined);
    const agents = [aNowAgent({ key: 'halted', name: 'Halted', status: 'stopped' })];
    useAppStore.setState({
      continueStoppedAgent,
      sessionPhaseRuns: { [NOW_SESSION]: agents },
      authResults: { anthropic: { state: 'disconnected', identity: null } },
    });
    const opened = vi.fn();
    window.addEventListener('goodboy:open-settings', opened);

    renderGrid({ runs: runsOf({ agents }) });

    expect(screen.queryByRole('button', { name: NAMES.continue })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Claude' }));
    window.removeEventListener('goodboy:open-settings', opened);
    expect(continueStoppedAgent).not.toHaveBeenCalled();
    expect(opened).toHaveBeenCalledOnce();
  });

  it('continues an operator stopped orchestrated run as a run when no step was cut', async () => {
    const retryWorkflowOrchestration = vi.fn(async () => undefined);
    useAppStore.setState({ retryWorkflowOrchestration });
    const plan = aNowRun({
      key: 'plan',
      title: 'Center every member page',
      isDynamic: true,
      workflow: aNowWorkflow({
        key: 'plan',
        name: 'Orchestrated',
        stepNames: ['Find'],
        origin: 'orchestrated',
      }),
      overrides: { orchestrationStop: { kind: 'operator', message: 'You stopped this run.' } },
    });
    const agents = [
      aNowStepAgent({ attached: plan, stepIndex: 0, status: 'completed', name: 'Find' }),
    ];
    useAppStore.setState({ sessionPhaseRuns: { [NOW_SESSION]: agents } });

    renderGrid({ runs: runsOf({ agents, attached: [plan] }) });
    fireEvent.click(screen.getByRole('button', { name: NAMES.continue }));

    await waitFor(() =>
      expect(retryWorkflowOrchestration).toHaveBeenCalledWith(NOW_SESSION, plan.run.id),
    );
  });

  it('starts a queued manual orchestrated run with a real Start', async () => {
    const startWorkflowRun = vi.fn(async () => undefined);
    useAppStore.setState({ startWorkflowRun });
    const plan = aNowRun({
      key: 'plan',
      title: 'Center every member page',
      isDynamic: true,
      workflow: aNowWorkflow({
        key: 'plan',
        name: 'Orchestrated',
        stepNames: ['Find'],
        origin: 'orchestrated',
      }),
      overrides: { triggerMode: 'manual' },
    });

    renderGrid({ runs: runsOf({ agents: [], attached: [plan] }) });
    screen.getByRole('button', { name: 'Open Center every member page, Workflow, Ready' });
    fireEvent.click(screen.getByRole('button', { name: NAMES.start }));

    await waitFor(() => expect(startWorkflowRun).toHaveBeenCalledWith(NOW_SESSION, plan.run.id));
  });
});

describe('RunsGrid by branch', () => {
  const PAYMENTS = aProject({ name: 'payments-api' });
  const NOTIFY = aProject({ name: 'notify-relay' });
  const DUP = aMountView({
    key: 'dup',
    sessionId: NOW_SESSION,
    projectId: PAYMENTS.id,
    projectName: 'payments-api',
    branch: 'fix/duplicate-credit',
  });
  const RETRY = aMountView({
    key: 'retry',
    sessionId: NOW_SESSION,
    projectId: NOTIFY.id,
    projectName: 'notify-relay',
    branch: 'feat/retry-budget',
  });

  type WorldParams = {
    readonly agents: ReadonlyArray<Agent>;
  };

  const renderWorld = ({ agents }: WorldParams) => {
    useAppStore.setState({
      sessionPhaseRuns: { [NOW_SESSION]: agents },
      sessionMounts: { [NOW_SESSION]: [DUP, RETRY] },
      projects: [PAYMENTS, NOTIFY],
    });
    return renderGrid({ runs: runsOf({ agents, mounts: [DUP, RETRY] }) });
  };

  const onDup = (key: string, name: string): Agent => ({
    ...aNowAgent({ key, name, status: 'running' }),
    mountId: DUP.id,
  });

  const onRetry = (key: string, name: string): Agent => ({
    ...aNowAgent({ key, name, status: 'running' }),
    mountId: RETRY.id,
  });

  it('opens on By branch with two branches and lists the runs of each branch under it', () => {
    renderWorld({
      agents: [onDup('block', 'Block double credits'), onRetry('limit', 'Limit retries')],
    });

    screen.getByRole('list', { name: 'feat/retry-budget' });
    const group = screen.getByRole('list', { name: 'fix/duplicate-credit' });
    expect(
      within(group).getAllByRole('button', { name: /^Open Block double credits/ }),
    ).toHaveLength(1);
  });

  it('repeats a run in each branch it touches, keyed by group, and says Also on', () => {
    const lead: Agent = {
      ...aNowAgent({ key: 'both', name: 'Limit webhook retries', status: 'running' }),
      mountId: DUP.id,
    };
    const child: Agent = {
      ...aNowAgent({ key: 'both-child', name: 'Retry child', status: 'running' }),
      parentAgentId: lead.id,
      mountId: RETRY.id,
    };
    renderWorld({ agents: [lead, child] });

    const dup = screen.getByRole('list', { name: 'fix/duplicate-credit' });
    const retry = screen.getByRole('list', { name: 'feat/retry-budget' });
    const rowKeys = [dup, retry].flatMap((group) =>
      Array.from(group.querySelectorAll('[data-row-key]')).map((row) =>
        row.getAttribute('data-row-key'),
      ),
    );
    expect(new Set(rowKeys).size).toBe(2);
    within(dup).getByText('Also on feat/retry-budget');
    within(retry).getByText('Also on fix/duplicate-credit');
  });

  it('puts a run without a branch last in No branch', () => {
    const explain = aNowAgent({
      key: 'explain',
      name: 'Explain the retry flow',
      status: 'running',
    });
    renderWorld({
      agents: [explain, onDup('block', 'Block double credits'), onRetry('limit', 'Limit retries')],
    });

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings.at(-1)).toBe('No branch');
  });

  it('switches to By state, remembers it for the session and lists each run once', () => {
    renderWorld({
      agents: [onDup('block', 'Block double credits'), onRetry('limit', 'Limit retries')],
    });

    fireEvent.click(screen.getByRole('tab', { name: 'By state' }));

    expect(useAppStore.getState().groupBySession[NOW_SESSION]).toBe('state');
    const running = screen.getByRole('list', { name: 'Running' });
    expect(within(running).getAllByRole('button')).toHaveLength(2);
    within(running).getByText('fix/duplicate-credit');
  });

  it('draws no switch and no branch groups with one branch', () => {
    renderWorld({ agents: [onDup('block', 'Block double credits'), onDup('second', 'Second')] });

    expect(screen.queryByRole('tab', { name: 'By state' })).toBeNull();
    screen.getByRole('list', { name: 'Running' });
  });

  it('shows one branch and a +1 on a By state row that touches two', () => {
    const lead: Agent = {
      ...aNowAgent({ key: 'lead', name: 'Move the backfill', status: 'running' }),
      mountId: DUP.id,
    };
    const child: Agent = {
      ...aNowAgent({ key: 'lead-child', name: 'Notify child', status: 'running' }),
      parentAgentId: lead.id,
      mountId: RETRY.id,
    };
    renderWorld({ agents: [lead, child, onRetry('limit', 'Limit retries')] });
    fireEvent.click(screen.getByRole('tab', { name: 'By state' }));

    const row = screen.getByRole('button', { name: /^Open Move the backfill/ });
    expect(row.querySelector('[data-run-branch]')?.textContent).toBe('fix/duplicate-credit');
    expect(row.querySelector('[data-run-branch-more]')?.textContent).toBe('+1');
  });

  it('shows Stop all and Continue all in the page action row of the By branch view', () => {
    const resumeStoppedAgents = vi.fn(async () => 2);
    useAppStore.setState({ resumeStoppedAgents });
    const stopped = (key: string, name: string, mountId: typeof DUP.id): Agent => ({
      ...aNowAgent({ key, name, status: 'stopped', stoppedBy: 'app' }),
      mountId,
    });
    renderWorld({
      agents: [
        onDup('block', 'Block double credits'),
        onRetry('limit', 'Limit retries'),
        stopped('first', 'First stopped', DUP.id),
        stopped('second', 'Second stopped', RETRY.id),
      ],
    });

    screen.getByRole('list', { name: 'fix/duplicate-credit' });
    const stopAll = screen.getByRole('button', { name: /^Stop all/ });
    const continueAll = screen.getByRole('button', { name: 'Continue all' });
    expect(stopAll.closest('[data-runs-actions]')).not.toBeNull();
    expect(continueAll.closest('[data-runs-actions]')).not.toBeNull();
    fireEvent.click(continueAll);
    expect(resumeStoppedAgents).toHaveBeenCalledWith({ sessionId: NOW_SESSION });
  });

  it('presses Continue once for a run that stands in two groups', async () => {
    let finish: () => void = () => undefined;
    const continueStoppedAgent = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const lead: Agent = {
      ...aNowAgent({ key: 'lead', name: 'Move the backfill', status: 'stopped' }),
      mountId: DUP.id,
    };
    const child: Agent = {
      ...aNowAgent({ key: 'lead-child', name: 'Notify child', status: 'completed' }),
      parentAgentId: lead.id,
      mountId: RETRY.id,
    };
    useAppStore.setState({ continueStoppedAgent });
    renderWorld({ agents: [lead, child] });

    const buttons = screen.getAllByRole('button', { name: NAMES.continue });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      fireEvent.click(button);
    }

    expect(continueStoppedAgent).toHaveBeenCalledOnce();
    finish();
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button', { name: NAMES.continue })
          .every((button) => !button.hasAttribute('disabled')),
      ).toBe(true),
    );
  });

  it('folds archived runs apart in a branch group and never shows them inline', () => {
    const old = aNowRun({
      key: 'old',
      title: 'Old layout fix',
      workflow: aNowWorkflow({ key: 'old', name: 'Fix a layout', stepNames: ['Find'] }),
      overrides: { discardedAt: NOW_STARTED_AT },
    });
    const oldStep: Agent = {
      ...aNowStepAgent({ attached: old, stepIndex: 0, status: 'completed', name: 'Find' }),
      mountId: DUP.id,
    };
    const agents = [onRetry('limit', 'Limit retries'), oldStep];
    useAppStore.setState({
      sessionPhaseRuns: { [NOW_SESSION]: agents },
      sessionMounts: { [NOW_SESSION]: [DUP, RETRY] },
      projects: [PAYMENTS, NOTIFY],
    });

    renderGrid({ runs: runsOf({ agents, attached: [old], mounts: [DUP, RETRY] }) });

    const group = screen.getByRole('list', { name: 'fix/duplicate-credit' });
    expect(within(group).queryByRole('button', { name: /Old layout fix/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 archived' }));
    within(group).getByRole('button', { name: /Old layout fix/ });
    screen.getByRole('button', { name: 'Hide archived' });
  });

  it('puts the archived runs of a group after its finished ones', () => {
    const old = aNowRun({
      key: 'old',
      title: 'Old layout fix',
      workflow: aNowWorkflow({ key: 'old', name: 'Fix a layout', stepNames: ['Find'] }),
      overrides: { discardedAt: NOW_STARTED_AT },
    });
    const oldStep: Agent = {
      ...aNowStepAgent({ attached: old, stepIndex: 0, status: 'completed', name: 'Find' }),
      mountId: DUP.id,
    };
    const finished: Agent = {
      ...aNowAgent({ key: 'fin', name: 'Finished one', status: 'completed' }),
      mountId: DUP.id,
    };
    const agents = [onRetry('limit', 'Limit retries'), oldStep, finished];
    useAppStore.setState({
      sessionPhaseRuns: { [NOW_SESSION]: agents },
      sessionMounts: { [NOW_SESSION]: [DUP, RETRY] },
      projects: [PAYMENTS, NOTIFY],
    });

    renderGrid({ runs: runsOf({ agents, attached: [old], mounts: [DUP, RETRY] }) });
    fireEvent.click(screen.getByRole('button', { name: '1 archived' }));

    const group = screen.getByRole('list', { name: 'fix/duplicate-credit' });
    const names = within(group)
      .getAllByRole('button', { name: /^Open / })
      .map((row) => row.getAttribute('aria-label'));
    expect(names.at(-1)).toMatch(/^Open Old layout fix/);
    expect(names[0]).toMatch(/^Open Finished one/);
  });

  it('opens on the remembered choice after a reload and writes the choice down', () => {
    localStorage.setItem(`goodboy:session-grouping:v1:${NOW_SESSION}`, 'state');

    renderWorld({
      agents: [onDup('block', 'Block double credits'), onRetry('limit', 'Limit retries')],
    });

    screen.getByRole('list', { name: 'Running' });
    expect(screen.queryByRole('list', { name: 'fix/duplicate-credit' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'By branch' }));
    expect(localStorage.getItem(`goodboy:session-grouping:v1:${NOW_SESSION}`)).toBe('branch');
  });
});
