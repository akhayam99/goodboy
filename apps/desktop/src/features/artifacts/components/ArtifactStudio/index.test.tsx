// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { notify, state, showToast, subscribers } = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    subscribers: listeners,
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    showToast: vi.fn(),
    state: {
      currentSessionId: 'sess-1',
      activeLens: { 'sess-1': 'plans' } as Record<string, string | null>,
      drawer: null as unknown,
      sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
      sessionArtifacts: {} as Record<string, ReadonlyArray<unknown>>,
      planConsumptions: {} as Record<string, ReadonlyArray<unknown>>,
      agentTurnState: {} as Record<string, { readonly kind: string }>,
      transcripts: {} as Record<string, ReadonlyArray<unknown>>,
      loadSessionArtifacts: vi.fn(async () => undefined),
      loadConsumptionsForPlan: vi.fn(async () => undefined),
      updatePlanBody: vi.fn(async () => undefined),
      updateArtifactSource: vi.fn(async () => undefined),
      deletePlan: vi.fn(async () => undefined),
      restorePlan: vi.fn(async () => undefined),
      runPlan: vi.fn(async () => 'agent-impl'),
      spawnReportAgent: vi.fn(async () => 'agent-report-3'),
      spawnWireframeAgent: vi.fn(async () => 'agent-wireframe-3'),
      selectAgent: vi.fn(async () => undefined),
      setCurrentSession: vi.fn(async () => undefined),
      setActiveLens: vi.fn(),
      openDrawer: vi.fn(),
      toggleDrawer: vi.fn(),
      focusedArtifactId: {} as Record<string, string | null>,
      setFocusedArtifactId: vi.fn((sessionId: string, artifactId: string | null) => {
        state.focusedArtifactId = { ...state.focusedArtifactId, [sessionId]: artifactId };
        notify();
      }),
      artifactFilter: {} as Record<string, string>,
      setArtifactFilter: vi.fn(),
      sessions: [] as ReadonlyArray<Record<string, unknown>>,
      selectedAgentId: {} as Record<string, string | null>,
      sessionStudio: {} as Record<string, unknown>,
      artifactCreation: {} as Record<
        string,
        { readonly kind: string; readonly note: string | null } | null
      >,
      openArtifactCreation: vi.fn(),
      closeArtifactCreation: vi.fn(),
      setArtifactDraft: vi.fn(),
      stopArtifactGeneration: vi.fn(async () => undefined),
      wireframeScoutVerification: {},
      plans: [] as ReadonlyArray<unknown>,
      openQuestions: [] as ReadonlyArray<unknown>,
    },
  };
});

vi.mock('../../../../store', async () => {
  const react = await import('react');
  const useAppStore = <T,>(selector: (s: typeof state) => T): T => {
    const [, bump] = react.useReducer((count: number) => count + 1, 0);
    react.useEffect(() => {
      subscribers.add(bump);
      return () => {
        subscribers.delete(bump);
      };
    }, [bump]);
    return selector(state);
  };
  useAppStore.getState = () => state;
  return {
    EMPTY_ARRAY: [] as readonly never[],
    useAppStore,
    useSessionPlans: () => state.plans,
    useSessionOpenQuestions: () => state.openQuestions,
  };
});

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../../useArtifactScoutRoster', () => ({
  useArtifactScoutRoster: () => ({ rows: [], isLoaded: true }),
}));

vi.mock('../ArtifactCreationPane', () => ({
  ArtifactCreationPane: ({
    kind,
    onStarted,
  }: {
    readonly kind: string;
    readonly onStarted: (agentId: string) => void;
  }) => (
    <div data-testid="artifact-creation-pane-stub">
      {kind}
      <button type="button" onClick={() => onStarted('agent-report-2')}>
        stub generate
      </button>
    </div>
  ),
}));

vi.mock('../../artifactProvenance', () => ({
  loadArtifactProvenance: vi.fn(async () => null),
}));

const report = {
  id: 'artifact-report',
  sessionId: 'sess-1',
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Rounding drift in ledger-core postings',
  sourceFormat: 'markdown',
  sourceText: '## What was wrong\nEach posting rounded its own share.',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 2,
  sourceTurnId: 'run-1',
  createdAt: '2026-09-14T18:27:00.000Z',
  updatedAt: '2026-09-14T18:27:00.000Z',
};

const wireframeDocument = {
  version: 1,
  initialScreenId: 'batches',
  theme: { name: 'generic' },
  screens: [
    {
      id: 'batches',
      title: 'Settlement batches',
      viewport: 'desktop',
      root: {
        id: 'batches-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'batches-title', kind: 'text', text: 'Batches', variant: 'title' }],
      },
    },
  ],
  transitions: [],
};

const wireframe = {
  ...report,
  id: 'artifact-wireframe',
  kind: 'wireframe',
  title: 'Settlement review flow',
  sourceFormat: 'json',
  sourceText: JSON.stringify(wireframeDocument),
  metadata: { fidelity: 'low', designProfile: {} },
  revision: 1,
  createdAt: '2026-09-14T18:34:00.000Z',
};

const plan = {
  id: 'plan-1',
  agentId: 'agent-planner',
  sessionId: 'sess-1',
  title: 'Backfill the settled batches',
  bodyMd: '## Goal\nEvery settled batch matches its invoice.',
  status: 'active',
  createdAt: '2026-09-14T19:34:00.000Z',
  updatedAt: '2026-09-14T19:34:00.000Z',
  consumptionCount: 0,
};

const reportAgent = {
  id: 'agent-report-2',
  name: 'Report 2',
  kind: 'report',
  status: 'completed',
  startedAt: '2026-09-14T18:00:00.000Z',
  lastFinishedAt: '2026-09-14T18:04:00.000Z',
};

beforeEach(() => {
  state.sessionPhaseRuns = {
    'sess-1': [
      { id: 'agent-1', name: 'Report 1' },
      { id: 'agent-planner', name: 'Planner 2' },
    ],
  };
  state.sessionArtifacts = {};
  state.planConsumptions = {};
  state.agentTurnState = {};
  state.transcripts = {};
  state.drawer = null;
  state.plans = [];
  state.openQuestions = [];
  state.focusedArtifactId = {};
  state.artifactFilter = {};
  state.sessions = [{ id: 'sess-1', goal: 'fix the rounding drift' }];
  state.selectedAgentId = {};
  state.sessionStudio = {};
  state.artifactCreation = {};
  vi.clearAllMocks();
});
afterEach(cleanup);

import { ArtifactStudio } from './index';

const renderStudio = () => render(<ArtifactStudio sessionId={'sess-1' as never} />);

const openRow = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

const focus = (artifactId: string) => {
  state.focusedArtifactId = { 'sess-1': artifactId };
};

describe('ArtifactStudio list', () => {
  it('loads the session artifacts on mount', () => {
    renderStudio();
    expect(state.loadSessionArtifacts).toHaveBeenCalledWith('sess-1');
  });

  it('says there is nothing yet when the session has no artifact', () => {
    renderStudio();
    expect(screen.getByRole('heading', { level: 1, name: 'Artifacts' })).toBeDefined();
    expect(screen.getByText('No artifacts yet')).toBeDefined();
  });

  it('lists plans, reports and wireframes as one list of rows, newest first, with no group eyebrows', () => {
    state.plans = [plan];
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    renderStudio();
    const list = screen.getByTestId('artifact-list');
    const titles = within(list)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(titles).toEqual([
      'Plan Backfill the settled batches, Ready to run',
      'Wireframe Settlement review flow, 1 screen',
      'Report Rounding drift in ledger-core postings, Session summary',
    ]);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.queryByText(/Show finished/)).toBeNull();
  });

  it('records the picked filter and shows only that kind', () => {
    state.plans = [plan];
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    state.artifactFilter = { 'sess-1': 'report' };
    renderStudio();
    expect(screen.getByText('Rounding drift in ledger-core postings')).toBeDefined();
    expect(screen.queryByText('Settlement review flow')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /plans/i }));
    expect(state.setArtifactFilter).toHaveBeenCalledWith({ sessionId: 'sess-1', filter: 'plan' });
  });

  it('starts a report or a wireframe from one New menu', () => {
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-new'));
    const menu = screen.getByRole('menu', { name: 'New artifact' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Wireframe/ }));
    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      kind: 'wireframe',
      workflowRunId: null,
    });
    expect(screen.queryByTestId('create-report-cta')).toBeNull();
  });

  it('shows a generation as a running row with a stop control', () => {
    state.sessionPhaseRuns = {
      'sess-1': [{ ...reportAgent, status: 'running', lastFinishedAt: undefined }],
    };
    state.agentTurnState = { 'agent-report-2': { kind: 'running' } };
    renderStudio();
    expect(screen.getByText('Writing')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(state.stopArtifactGeneration).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-report-2',
    });
  });

  it('offers try again on a generation that produced nothing', async () => {
    state.sessionPhaseRuns = { 'sess-1': [reportAgent] };
    renderStudio();
    expect(screen.getByText('No report')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(state.openArtifactCreation).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        kind: 'report',
        workflowRunId: null,
        note: 'the brief of this generation was not recorded',
      });
    });
  });

  it('opens the agent behind a generation that produced nothing', () => {
    state.sessionPhaseRuns = { 'sess-1': [reportAgent] };
    renderStudio();
    openRow(/Report 2/);
    expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-report-2');
  });

  it('renders the creation pane over the list when creation is open', () => {
    state.artifactCreation = { 'sess-1': { kind: 'wireframe', note: null } };
    renderStudio();
    expect(screen.getByTestId('artifact-creation-pane-stub').textContent).toContain('wireframe');
    expect(screen.queryByTestId('artifact-list')).toBeNull();
  });

  it('opens the reader when the awaited artifact arrives', () => {
    state.artifactCreation = { 'sess-1': { kind: 'report', note: null } };
    const { rerender } = renderStudio();
    fireEvent.click(screen.getByText('stub generate'));
    state.artifactCreation = {};
    state.sessionArtifacts = { 'sess-1': [{ ...report, agentId: 'agent-report-2' }] };
    rerender(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(state.setFocusedArtifactId).toHaveBeenLastCalledWith('sess-1', 'artifact-report');
  });

  it('opens a plan and a report through the same artifact focus', () => {
    state.plans = [plan];
    state.sessionArtifacts = { 'sess-1': [report] };
    renderStudio();
    openRow(/Backfill the settled batches/);
    expect(state.setFocusedArtifactId).toHaveBeenLastCalledWith('sess-1', 'plan-1');
    expect(screen.getByTestId('artifact-shell').getAttribute('data-artifact-kind')).toBe('plan');
  });
});

describe('ArtifactStudio shell', () => {
  it('opens a report in the shared shell: title once, meta line, Edit and More, no tabs', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    const header = screen.getByTestId('artifact-shell-header');
    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe(
      'Rounding drift in ledger-core postings',
    );
    expect(within(header).getByTestId('artifact-creator').textContent).toBe('Report 1');
    expect(within(header).getByText('rev 2')).toBeDefined();
    expect(within(header).getByTestId('artifact-action-edit')).toBeDefined();
    expect(within(header).queryByTestId('artifact-action-runPlan')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Conversation' })).toBeNull();
    expect(screen.getByText('Each posting rounded its own share.')).toBeDefined();
  });

  it('keeps every export behind More, with a label on each row', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('menu', { name: 'More' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Open in window'),
      expect.stringContaining('Print'),
      expect.stringContaining('Regenerate'),
      'Copy markdown',
      'Save markdown to…',
    ]);
  });

  it('edits a report in place and saves the source on Save', async () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-action-edit'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '## Rewritten' } });
    fireEvent.click(screen.getByTestId('artifact-save'));
    await waitFor(() => {
      expect(state.updateArtifactSource).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        artifactId: 'artifact-report',
        title: 'Rounding drift in ledger-core postings',
        sourceFormat: 'markdown',
        sourceText: '## Rewritten',
        metadata: { reportType: 'session-summary' },
      });
    });
  });

  it('drops an edit on Cancel without saving', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-action-edit'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(state.updateArtifactSource).not.toHaveBeenCalled();
  });

  it('runs a ready plan from its one primary', async () => {
    state.plans = [plan];
    focus('plan-1');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-action-runPlan'));
    await waitFor(() => expect(state.runPlan).toHaveBeenCalledWith('sess-1', 'plan-1'));
  });

  it('saves a plan edit as title and body', async () => {
    state.plans = [plan];
    focus('plan-1');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-action-edit'));
    const textbox = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textbox.value).toBe(
      '# Backfill the settled batches\n\n## Goal\nEvery settled batch matches its invoice.',
    );
    fireEvent.change(textbox, { target: { value: '# Backfill once\n\n## Goal\nmatch' } });
    fireEvent.click(screen.getByTestId('artifact-save'));
    await waitFor(() =>
      expect(state.updatePlanBody).toHaveBeenCalledWith(
        'sess-1',
        'plan-1',
        'Backfill once',
        '## Goal\nmatch',
      ),
    );
  });

  it('never offers discard on a plan that already ran, and asks before running it again', async () => {
    state.plans = [{ ...plan, status: 'consumed', consumptionCount: 1 }];
    focus('plan-1');
    renderStudio();
    expect(screen.queryByTestId('artifact-action-runPlan')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('menu', { name: 'More' });
    expect(within(menu).queryByRole('menuitem', { name: /Discard/ })).toBeNull();
    fireEvent.keyDown(menu, { key: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.setFocusedArtifactId).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('artifact-action-runAgain'));
    expect(state.runPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Run again' }));
    await waitFor(() => expect(state.runPlan).toHaveBeenCalledWith('sess-1', 'plan-1'));
  });

  it('opens Details and Chat in the right drawer instead of inline tabs', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-drawer-details'));
    expect(state.toggleDrawer).toHaveBeenCalledWith({
      kind: 'artifact',
      sessionId: 'sess-1',
      payload: { artifactId: 'artifact-report', tab: 'details' },
    });
    fireEvent.click(screen.getByTestId('artifact-built-from-link'));
    expect(state.openDrawer).toHaveBeenCalledWith({
      kind: 'artifact',
      sessionId: 'sess-1',
      payload: { artifactId: 'artifact-report', tab: 'details' },
    });
  });

  it('goes back to the list on Escape, but leaves Escape to the drawer while it is open', async () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    focus('artifact-report');
    state.drawer = {
      kind: 'artifact',
      sessionId: 'sess-1',
      lens: 'plans',
      payload: { artifactId: 'artifact-report', tab: 'details' },
    };
    const { rerender } = renderStudio();
    fireEvent.keyDown(window, { key: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.setFocusedArtifactId).not.toHaveBeenCalled();
    state.drawer = null;
    rerender(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() =>
      expect(state.setFocusedArtifactId).toHaveBeenLastCalledWith('sess-1', null),
    );
  });

  it('opens a wireframe on its flow, with Export as the secondary and the variant under More', () => {
    state.sessionArtifacts = { 'sess-1': [wireframe] };
    focus('artifact-wireframe');
    renderStudio();
    expect(screen.getByTestId('wireframe-studio').getAttribute('data-view')).toBe('flow');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /New variant/ }));
    expect(state.spawnWireframeAgent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', fidelity: 'high' }),
    );
  });

  it('says what each export gives, and offers the screen only while one is open', async () => {
    const writeText = vi.fn(async (text: string) => text.length);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    state.sessionArtifacts = { 'sess-1': [wireframe] };
    focus('artifact-wireframe');
    renderStudio();
    fireEvent.click(screen.getByTestId('artifact-action-export'));
    const menu = screen.getByRole('menu', { name: 'Export' });
    expect(within(menu).getByText('The validated document, ready to paste')).toBeDefined();
    expect(within(menu).queryByRole('menuitem', { name: /Copy this screen/ })).toBeNull();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Copy JSON/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('tab', { name: 'Screens' }));
    fireEvent.click(screen.getByTestId('artifact-action-export'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy this screen as JSON/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(JSON.parse(writeText.mock.calls[1]?.[0] ?? '{}').id).toBe('batches');
  });

  it('opens a plan another surface focused, as a plan', () => {
    state.plans = [plan];
    focus('plan-1');
    renderStudio();
    expect(screen.getByTestId('artifact-shell').getAttribute('data-artifact-kind')).toBe('plan');
    expect(screen.getByText('Every settled batch matches its invoice.')).toBeDefined();
  });
});

describe('ArtifactStudio plan parts', () => {
  const clusters = [
    {
      title: 'Add a dry run to the backfill job',
      instructions: 'add a flag',
      doneWhen: ['run pnpm test ledger-core'],
      touches: ['ledger-core/src/backfill.ts', 'ledger-core/src/flags.ts'],
    },
    { title: 'Skip settled batches in retries', instructions: 'notify-relay' },
  ];

  it('lists the parts after the goal and says who split the plan', () => {
    state.plans = [
      {
        ...plan,
        bodyMd: '## Goal\nEvery settled batch matches its invoice.\n\n## Risks\nnone',
        clusters,
      },
    ];
    focus('plan-1');
    renderStudio();
    const parts = screen.getByTestId('plan-parts');
    expect(
      within(parts).getByText(
        'Planner 2 split this plan into 2 parts. They run in order, each as its own subagent.',
      ),
    ).toBeDefined();
    expect(within(parts).getByText('Done when: run pnpm test ledger-core')).toBeDefined();
    expect(within(parts).getByText('2 files')).toBeDefined();
    expect(within(parts).getAllByText('Auto')).toHaveLength(2);
    const body = screen.getByTestId('plan-body');
    expect(body.textContent?.indexOf('Every settled batch')).toBeLessThan(
      body.textContent?.indexOf('Parts') ?? 0,
    );
    fireEvent.click(within(parts).getByRole('button', { name: /Part 2, Skip settled/ }));
    expect(state.openDrawer).toHaveBeenCalledWith({
      kind: 'plan-part',
      sessionId: 'sess-1',
      payload: { planId: 'plan-1', index: 1 },
    });
  });

  it('gives each part the state of its subagent once the plan runs, and hides run again', () => {
    state.plans = [
      {
        ...plan,
        clusters,
        status: 'consumed',
        consumptionCount: 1,
        lastConsumer: { agentId: 'agent-impl', name: 'Implementer 3' },
      },
    ];
    state.sessionPhaseRuns = {
      'sess-1': [
        { id: 'agent-planner', name: 'Planner 2', ordinal: 0 },
        { id: 'agent-impl', name: 'Implementer 3', status: 'running', ordinal: 1 },
        {
          id: 'agent-part-1',
          name: 'Add a dry run',
          parentAgentId: 'agent-impl',
          status: 'completed',
          ordinal: 2,
        },
        {
          id: 'agent-part-2',
          name: 'Skip settled',
          parentAgentId: 'agent-impl',
          status: 'running',
          ordinal: 3,
        },
      ],
    };
    focus('plan-1');
    renderStudio();
    expect(screen.getByTestId('artifact-state-chip').textContent).toContain('Running part 2 of 2');
    expect(screen.queryByTestId('artifact-action-runAgain')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Part 1, Add a dry run/ }));
    expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-part-1');
  });
});

describe('ArtifactStudio generating run', () => {
  beforeEach(() => {
    state.sessionPhaseRuns = {
      'sess-1': [
        {
          ...reportAgent,
          id: 'agent-wireframe-live',
          name: 'High fidelity',
          kind: 'wireframe',
          status: 'running',
          lastFinishedAt: undefined,
        },
      ],
    };
    state.agentTurnState = { 'agent-wireframe-live': { kind: 'running' } };
  });

  it('opens the run in the same shell, with Stop as its secondary and the agent under More', () => {
    renderStudio();
    openRow(/High fidelity/);
    expect(screen.getByTestId('artifact-run-detail')).toBeDefined();
    fireEvent.click(screen.getByTestId('artifact-action-stop'));
    expect(state.stopArtifactGeneration).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-wireframe-live',
    });
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Open agent/ }));
    expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-wireframe-live');
  });

  it('follows the run to the artifact it produced', () => {
    const { rerender } = renderStudio();
    openRow(/High fidelity/);
    state.sessionArtifacts = { 'sess-1': [{ ...wireframe, agentId: 'agent-wireframe-live' }] };
    rerender(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(state.setFocusedArtifactId).toHaveBeenLastCalledWith('sess-1', 'artifact-wireframe');
  });
});
