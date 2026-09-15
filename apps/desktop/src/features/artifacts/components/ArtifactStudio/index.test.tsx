// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state, showToast } = vi.hoisted(() => ({
  showToast: vi.fn(),
  state: {
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionArtifacts: {} as Record<string, ReadonlyArray<unknown>>,
    planConsumptions: {} as Record<string, ReadonlyArray<unknown>>,
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
    setFocusedPlanId: vi.fn(),
    lensHistory: {} as Record<string, { readonly index: number }>,
    lensGo: vi.fn(),
    plans: [] as ReadonlyArray<unknown>,
    openQuestions: [] as ReadonlyArray<unknown>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionPlans: () => state.plans,
  useSessionOpenQuestions: () => state.openQuestions,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
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

const wireframe = {
  ...report,
  id: 'artifact-wireframe',
  kind: 'wireframe',
  title: 'Onboarding flow',
  sourceFormat: 'json',
  sourceText: '{"screens":[]}',
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

beforeEach(() => {
  state.sessionPhaseRuns = { 'sess-1': [{ id: 'agent-1', name: 'reporter' }] };
  state.sessionArtifacts = {};
  state.planConsumptions = {};
  state.plans = [];
  state.focusedPlanId = {};
  state.loadSessionArtifacts.mockClear();
  state.setFocusedPlanId.mockClear();
});
afterEach(cleanup);

import { ArtifactStudio } from './index';

describe('ArtifactStudio', () => {
  it('loads the session artifacts on mount', () => {
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(state.loadSessionArtifacts).toHaveBeenCalledWith('sess-1');
  });

  it('shows the plans pane when the session has no standalone artifacts', () => {
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Plans' })).toBeDefined();
    expect(screen.queryByTestId('artifact-rail')).toBeNull();
  });

  it('lists standalone artifacts grouped by kind', () => {
    state.sessionArtifacts = { 'sess-1': [report, wireframe] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    expect(screen.getByTestId('artifact-rail')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Reports' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Wireframes' })).toBeDefined();
    expect(screen.getByText('Session report')).toBeDefined();
    expect(screen.getByText('Onboarding flow')).toBeDefined();
  });

  it('opens a report with its provenance, status and export slot', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Session report'));
    expect(screen.getByRole('heading', { level: 1, name: 'Artifacts' })).toBeDefined();
    expect(screen.getByText('reporter')).toBeDefined();
    expect(screen.getByText('rev 2')).toBeDefined();
    expect(screen.getByText('active')).toBeDefined();
    expect(screen.getByTestId('artifact-export-slot')).toBeDefined();
    expect(screen.getByText('shipped it')).toBeDefined();
  });

  it('renders a wireframe as pretty printed json', () => {
    state.sessionArtifacts = { 'sess-1': [wireframe] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Onboarding flow'));
    expect(screen.getByTestId('artifact-json-source').textContent).toContain('"screens"');
  });

  it('returns to the plans pane from an artifact', () => {
    state.sessionArtifacts = { 'sess-1': [report] };
    render(<ArtifactStudio sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByText('Session report'));
    fireEvent.click(screen.getByRole('button', { name: /all artifacts/i }));
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
});
