// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
      sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
      sessionArtifacts: {} as Record<string, ReadonlyArray<unknown>>,
      planConsumptions: {} as Record<string, ReadonlyArray<unknown>>,
      agentTurnState: {} as Record<string, { readonly kind: string }>,
      loadSessionArtifacts: vi.fn(async () => undefined),
      loadConsumptionsForPlan: vi.fn(async () => undefined),
      updatePlanBody: vi.fn(async () => undefined),
      deletePlan: vi.fn(async () => undefined),
      restorePlan: vi.fn(async () => undefined),
      runPlan: vi.fn(async () => 'agent-impl'),
      selectAgent: vi.fn(async () => undefined),
      setCurrentSession: vi.fn(async () => undefined),
      setActiveLens: vi.fn(),
      focusedPlanId: {} as Record<string, string | null>,
      setFocusedPlanId: vi.fn((sessionId: string, planId: string | null) => {
        state.focusedPlanId = { ...state.focusedPlanId, [sessionId]: planId };
        state.focusedArtifactId = { ...state.focusedArtifactId, [sessionId]: null };
        notify();
      }),
      focusedArtifactId: {} as Record<string, string | null>,
      setFocusedArtifactId: vi.fn((sessionId: string, artifactId: string | null) => {
        state.focusedArtifactId = { ...state.focusedArtifactId, [sessionId]: artifactId };
        state.focusedPlanId = { ...state.focusedPlanId, [sessionId]: null };
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
      cancelCurrentTurn: vi.fn(async () => undefined),
      lensHistory: {} as Record<string, { readonly index: number }>,
      lensGo: vi.fn(),
      plans: [] as ReadonlyArray<unknown>,
      openQuestions: [] as ReadonlyArray<unknown>,
    },
  };
});

vi.mock('../../../../store', async () => {
  const react = await import('react');
  return {
    EMPTY_ARRAY: [] as readonly never[],
    useAppStore: <T,>(selector: (s: typeof state) => T): T => {
      const [, bump] = react.useReducer((count: number) => count + 1, 0);
      react.useEffect(() => {
        subscribers.add(bump);
        return () => {
          subscribers.delete(bump);
        };
      }, [bump]);
      return selector(state);
    },
    useSessionPlans: () => state.plans,
    useSessionOpenQuestions: () => state.openQuestions,
  };
});

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../ArtifactCreationPane', () => ({
  ArtifactCreationPane: ({
    kind,
    note,
    onStarted,
  }: {
    readonly kind: string;
    readonly note: string | null;
    readonly onStarted: (agentId: string) => void;
  }) => (
    <div data-testid="artifact-creation-pane-stub">
      {kind}
      {note}
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
  title: 'Session report',
  sourceFormat: 'markdown',
  sourceText: '## Outcome\nshipped it',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 2,
  sourceTurnId: 'run-1',
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: '2026-01-02T03:04:05.000Z',
};

const wireframeDocument = {
  version: 1,
  initialScreenId: 'welcome',
  theme: { name: 'generic' },
  screens: [
    {
      id: 'welcome',
      title: 'Welcome',
      viewport: 'desktop',
      root: {
        id: 'welcome-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'welcome-title', kind: 'text', text: 'Welcome', variant: 'title' }],
      },
    },
  ],
  transitions: [],
};

const wireframe = {
  ...report,
  id: 'artifact-wireframe',
  kind: 'wireframe',
  title: 'Onboarding flow',
  sourceFormat: 'json',
  sourceText: JSON.stringify(wireframeDocument),
  metadata: { fidelity: 'low', designProfile: {} },
  revision: 1,
};

const plan = {
  id: 'plan-1',
  agentId: 'agent-1',
  sessionId: 'sess-1',
  title: 'Ship the thing',
  bodyMd: 'step one',
  status: 'active',
  createdAt: '2026-01-02T03:04:05.000Z',
  consumptionCount: 0,
};

const reportAgent = {
  id: 'agent-report-2',
  name: 'Session summary',
  kind: 'report',
  status: 'completed',
  startedAt: '2026-01-02T03:00:00.000Z',
  lastFinishedAt: '2026-01-02T03:04:00.000Z',
};

const wireframeAgent = {
  ...reportAgent,
  id: 'agent-wireframe-2',
  name: 'Low fidelity',
  kind: 'wireframe',
};

beforeEach(() => {
  state.sessionPhaseRuns = { 'sess-1': [{ id: 'agent-1', name: 'reporter' }] };
  state.sessionArtifacts = {};
  state.planConsumptions = {};
  state.agentTurnState = {};
  state.plans = [];
  state.focusedPlanId = {};
  state.focusedArtifactId = {};
  state.artifactFilter = {};
  state.sessions = [{ id: 'sess-1', goal: 'fix the rounding drift' }];
  state.selectedAgentId = {};
  state.sessionStudio = {};
  state.artifactCreation = {};
  state.loadSessionArtifacts.mockClear();
  state.openArtifactCreation.mockClear();
  state.closeArtifactCreation.mockClear();
  state.setArtifactDraft.mockClear();
  state.cancelCurrentTurn.mockClear();
  state.setFocusedPlanId.mockClear();
  state.setFocusedArtifactId.mockClear();
  state.setArtifactFilter.mockClear();
  state.selectAgent.mockClear();
});
afterEach(cleanup);

import { ArtifactStudio } from './index';

describe('ArtifactStudio', () => {
  it('loads the session artifacts on mount', () => {
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(state.loadSessionArtifacts).toHaveBeenCalledWith('sess-1');
  });

  it('shows the artifact collection with an empty state when the session has nothing', () => {
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Artifacts' })).toBeDefined();
    expect(screen.getByText('No artifacts yet')).toBeDefined();
    expect(screen.queryByRole('heading', { level: 2, name: 'Reports' })).toBeNull();
  });

  it('groups plans, reports and wireframes in one collection', () => {
    state.plans = [plan];
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Plans' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Reports' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Wireframes' })).toBeDefined();
    expect(screen.getByText('Ship the thing')).toBeDefined();
    expect(screen.getByText('Session report')).toBeDefined();
    expect(screen.getByText('Onboarding flow')).toBeDefined();
  });

  it('records the picked filter for the session', () => {
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByRole('tab', { name: /reports/i }));
    expect(state.setArtifactFilter).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      filter: 'report',
    });
  });

  it('shows only the picked kind once the filter is set', () => {
    state.plans = [plan];
    state.artifactFilter = { 'sess-1': 'report' };
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('Session report')).toBeDefined();
    expect(screen.queryByText('Onboarding flow')).toBeNull();
    expect(screen.queryByText('Ship the thing')).toBeNull();
  });

  it('says a report kind is empty instead of showing the other kinds', () => {
    state.sessionArtifacts = { 'sess-1': [wireframe] };
    state.artifactFilter = { 'sess-1': 'report' };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('No reports yet')).toBeDefined();
    expect(screen.queryByText('Onboarding flow')).toBeNull();
  });

  it('keeps the filter applied when coming back from an artifact', () => {
    state.artifactFilter = { 'sess-1': 'report' };
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Session report'));
    fireEvent.click(screen.getByRole('button', { name: /all artifacts/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Artifacts' })).toBeDefined();
    expect(screen.queryByText('Onboarding flow')).toBeNull();
  });

  it('lists a report agent that is still generating', () => {
    state.sessionPhaseRuns = {
      'sess-1': [{ ...reportAgent, status: 'running', lastFinishedAt: undefined }],
    };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Reports' })).toBeDefined();
    expect(screen.getByText('Session summary')).toBeDefined();
    expect(screen.getByText('generating')).toBeDefined();
  });

  it('counts a live turn as generating even while the agent row still reads pending', () => {
    state.sessionPhaseRuns = { 'sess-1': [{ ...reportAgent, status: 'pending' }] };
    state.agentTurnState = { 'agent-report-2': { kind: 'running' } };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('generating')).toBeDefined();
  });

  it('says no report was produced when the turn finished without one', () => {
    state.sessionPhaseRuns = { 'sess-1': [reportAgent] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('no report produced')).toBeDefined();
  });

  it('says a wireframe could not be read when the turn finished without one', () => {
    state.sessionPhaseRuns = { 'sess-1': [wireframeAgent] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Wireframes' })).toBeDefined();
    expect(screen.getByText('wireframe could not be read')).toBeDefined();
  });

  it('drops the generation row once that agent produced its artifact', () => {
    state.sessionPhaseRuns = { 'sess-1': [{ ...reportAgent, id: 'agent-1' }] };
    state.sessionArtifacts = { 'sess-1': [report] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.queryByText('no report produced')).toBeNull();
    expect(screen.getByText('Session report')).toBeDefined();
  });

  it('renders the creation pane over the collection when creation is open', () => {
    state.artifactCreation = { 'sess-1': { kind: 'wireframe', note: null } };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByTestId('artifact-creation-pane-stub').textContent).toContain('wireframe');
    expect(screen.queryByRole('heading', { level: 2, name: 'Reports' })).toBeNull();
  });

  it('shows the model and a stop control on a running generation', () => {
    state.sessionPhaseRuns = {
      'sess-1': [
        {
          ...reportAgent,
          status: 'running',
          lastFinishedAt: undefined,
          providerOverride: 'anthropic',
          modelOverride: 'claude-sonnet-5',
        },
      ],
    };
    state.agentTurnState = { 'agent-report-2': { kind: 'running' } };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText(/Claude/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(state.cancelCurrentTurn).toHaveBeenCalledWith('sess-1', 'agent-report-2');
  });

  it('offers try again on a generation that produced nothing', async () => {
    state.sessionPhaseRuns = { 'sess-1': [reportAgent] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(state.openArtifactCreation).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        kind: 'report',
        workflowRunId: null,
        note: 'the brief of this generation was not recorded',
      });
    });
    expect(state.setArtifactDraft).toHaveBeenCalled();
  });

  it('opens the reader when the awaited artifact arrives on the collection', () => {
    state.artifactCreation = { 'sess-1': { kind: 'report', note: null } };
    const { rerender } = render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('stub generate'));
    state.artifactCreation = {};
    state.sessionArtifacts = { 'sess-1': [{ ...report, agentId: 'agent-report-2' }] };
    rerender(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByTestId('artifact-export-slot')).toBeDefined();
  });

  it('records completion without stealing focus once the user opened something else', () => {
    state.artifactCreation = { 'sess-1': { kind: 'report', note: null } };
    const { rerender } = render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('stub generate'));
    state.artifactCreation = {};
    state.selectedAgentId = { 'sess-1': 'agent-report-2' };
    state.sessionArtifacts = { 'sess-1': [{ ...report, agentId: 'agent-report-2' }] };
    rerender(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.queryByTestId('artifact-export-slot')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Reports' })).toBeDefined();
  });

  it('opens the agent behind a generation that produced nothing', () => {
    state.sessionPhaseRuns = { 'sess-1': [reportAgent] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Session summary'));
    expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-report-2');
  });

  it('opens a report with its provenance, status and export slot', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Session report'));
    expect(screen.getByRole('heading', { level: 1, name: 'Artifacts' })).toBeDefined();
    expect(screen.getByText('reporter')).toBeDefined();
    expect(screen.getByText('rev 2')).toBeDefined();
    expect(screen.queryByText('active')).toBeNull();
    expect(screen.getByTestId('artifact-export-slot')).toBeDefined();
    expect(screen.getByText('shipped it')).toBeDefined();
  });

  it('keeps the plan lifecycle vocabulary off reports and wireframes', () => {
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.queryByText('active')).toBeNull();
    expect(screen.queryByText('consumed')).toBeNull();
  });

  it('still surfaces superseded on a report because a newer revision replaced it', () => {
    state.sessionArtifacts = { 'sess-1': [{ ...report, status: 'superseded' }] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByText('superseded')).toBeDefined();
  });

  it('offers markdown export on a report and json export on a wireframe, both printable', () => {
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Session report'));
    expect(screen.getByTestId('artifact-save-source').textContent).toContain('Save markdown');
    expect(screen.getByTestId('artifact-save-pdf').hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /all artifacts/i }));
    fireEvent.click(screen.getByText('Onboarding flow'));
    expect(screen.getByTestId('artifact-save-source').textContent).toContain('Save JSON');
    expect(screen.getByTestId('artifact-save-pdf').hasAttribute('disabled')).toBe(false);
  });

  it('opens a wireframe in the native renderer instead of the markdown reader', () => {
    state.sessionArtifacts = { 'sess-1': [wireframe] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Onboarding flow'));
    expect(screen.getByTestId('wireframe-studio')).toBeDefined();
    expect(screen.getByTestId('wireframe-screen').getAttribute('data-screen-id')).toBe('welcome');
    expect(screen.queryByTestId('artifact-json-source')).toBeNull();
  });

  it('falls back to the json source when the wireframe does not match the schema', () => {
    state.sessionArtifacts = {
      'sess-1': [{ ...wireframe, sourceText: '{"screens":[]}' }],
    };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Onboarding flow'));
    expect(screen.getByTestId('wireframe-issues')).toBeDefined();
    expect(screen.getByTestId('artifact-json-source').textContent).toContain('"screens"');
  });

  it('returns to the collection from an artifact', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Session report'));
    fireEvent.click(screen.getByRole('button', { name: /all artifacts/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Artifacts' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Reports' })).toBeDefined();
  });

  it('focuses a plan picked from the collection', () => {
    state.plans = [plan];
    state.sessionArtifacts = { 'sess-1': [report] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Ship the thing'));
    expect(state.setFocusedPlanId).toHaveBeenCalledWith('sess-1', 'plan-1');
  });

  it('opens a cited report in place of the one being read', () => {
    const earlier = {
      ...report,
      id: 'artifact-report-2',
      title: 'Earlier report',
      sourceText: 'this supersedes artifact-report',
    };
    state.sessionArtifacts = { 'sess-1': [report, earlier] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Earlier report'));
    fireEvent.click(screen.getByTestId('report-source-chip'));
    expect(screen.getByText('shipped it')).toBeDefined();
    expect(state.setFocusedArtifactId).toHaveBeenCalledWith('sess-1', 'artifact-report');
    expect(state.focusedPlanId['sess-1']).toBeNull();
  });

  it('focuses a cited plan as a plan and leaves the artifact detail', () => {
    const cited = { ...plan, sourceText: 'step one', kind: 'plan', schemaVersion: 1 };
    state.sessionArtifacts = {
      'sess-1': [{ ...report, sourceText: 'built from plan-1' }, cited],
    };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Session report'));
    fireEvent.click(screen.getByTestId('report-source-chip'));
    expect(state.setFocusedPlanId).toHaveBeenCalledWith('sess-1', 'plan-1');
    expect(state.focusedArtifactId['sess-1']).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Plans' })).toBeDefined();
  });

  it('keeps the plan-only controls on a focused plan', () => {
    state.plans = [plan];
    state.focusedPlanId = { 'sess-1': 'plan-1' };
    state.sessionArtifacts = { 'sess-1': [report] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Plans' })).toBeDefined();
    expect(screen.getByRole('button', { name: /start/i })).toBeDefined();
    expect(screen.getByLabelText('Delete plan')).toBeDefined();
    expect(screen.getByRole('tab', { name: /edit/i })).toBeDefined();
  });

  it('returns to the collection when the crumb clears the plan focus', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Session report'));
    expect(screen.getByTestId('artifact-export-slot')).toBeDefined();

    act(() => {
      state.setFocusedPlanId('sess-1', null);
    });

    expect(screen.queryByTestId('artifact-export-slot')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Reports' })).toBeDefined();
  });

  it('opens the artifact another surface focused in the store', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    state.focusedArtifactId = { 'sess-1': 'artifact-report' };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByTestId('artifact-export-slot')).toBeDefined();
    expect(screen.getByRole('button', { name: /all artifacts/i })).toBeDefined();
  });
});
