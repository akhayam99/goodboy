// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { ImpactMetrics } from '../../hooks/useImpactMetrics';

const mocks = vi.hoisted(() => ({
  metrics: null as unknown as ImpactMetrics,
  retry: vi.fn(),
  useImpactMetrics: vi.fn(),
  sessions: [] as ReadonlyArray<{ id: string; goal: string }>,
  state: {
    navigate: vi.fn(),
    currentSessionId: null,
    currentWorkspaceId: 'workspace-1',
    sessionTelemetry: {},
    providerSpendBreakdown: [],
    budgetAlerts: [],
    budgetRules: [],
    sessionBudgets: {},
    dismissBudgetAlert: vi.fn(),
    saveBudgetRule: vi.fn(),
    deleteBudgetRule: vi.fn(),
    setSessionBudget: vi.fn(),
    refreshProviderSpendBreakdown: vi.fn(),
    loadBudgetRules: vi.fn(async () => undefined),
    loadBudgetAlerts: vi.fn(async () => undefined),
    loadSessionTelemetry: vi.fn(async () => undefined),
    loadSessionBudget: vi.fn(async () => undefined),
  },
}));

vi.mock('../../hooks/useImpactMetrics', () => ({
  useImpactMetrics: mocks.useImpactMetrics,
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (state: typeof mocks.state) => T) => selector(mocks.state),
  useSessions: () => mocks.sessions,
  useTelemetryForSessions: () => mocks.state.sessionTelemetry,
}));

import { ImpactStudio } from './index';

const result = <T,>(data: T) => ({ data, error: null });
const sessionId = 'session-1' as SessionId;

const buildMetrics = (): ImpactMetrics => ({
  overview: result({
    sessionCount: 4,
    orchestratedSessions: 3,
    previousSessionCount: 2,
    previousOrchestratedSessions: 1,
    medianSessionHours: 2,
    previousMedianSessionHours: 3,
    sessions: [{ sessionId, goal: 'Ship impact studio', value: 2 }],
    spendUsd: 12.5,
    spendSessions: [{ sessionId, goal: 'Ship impact studio', value: 7.25 }],
  }),
  pullRequests: result({
    open: 2,
    merged: 3,
    closed: 1,
    previousOpen: 1,
    previousMerged: 2,
    entries: [
      {
        sessionId,
        goal: 'Ship impact studio',
        number: 42,
        title: 'Outcome and tempo',
        state: 'merged',
        spendUsd: 3.5,
      },
    ],
  }),
  reviews: result({
    commentsResolved: 6,
    previousCommentsResolved: 3,
    medianResolveHours: 1.5,
    publishedDrafts: 4,
    pushedResolutions: 2,
    resolutionOutcomes: [{ outcome: 'resolved', count: 2 }],
    resolutionDurationsHours: [0.5, 2, 30],
    hotFiles: [{ filePath: 'src/hot.ts', comments: 3 }],
    sessions: [{ sessionId, goal: 'Ship impact studio', value: 6 }],
  }),
  externalTasks: result({
    linked: 5,
    launched: 2,
    sessions: [{ sessionId, goal: 'Ship impact studio', value: 1 }],
  }),
  agentDurations: result({
    totalAgents: 8,
    byKind: [{ kind: 'implementer', agents: 8, medianHours: 1, p90Hours: 4 }],
  }),
  flowHealth: result({
    medianSessionHours: 2,
    p90SessionHours: 8,
    answeredQuestions: 3,
    medianQuestionHours: 0.5,
    questionBlockedSessions: 2,
    staleQuestions: 1,
    failedAgents: 1,
    budgetAlerts: 2,
    sessions: [{ sessionId, goal: 'Ship impact studio', value: 8 }],
  }),
  cacheEfficiency: result([
    {
      provider: 'anthropic',
      inputTokens: 1000,
      cachedInputTokens: 600,
      cacheCreationInputTokens: 100,
      hitRatio: 0.6,
    },
  ]),
  contextGrowth: result([
    { recordedAt: 1, contextTokens: 100 },
    { recordedAt: 2, contextTokens: 300 },
  ]),
  turns: result([
    { turnCount: 2, agentCount: 2 },
    { turnCount: 5, agentCount: 1 },
  ]),
  nudges: result([
    { outcome: 'accepted', count: 3 },
    { outcome: 'overridden', count: 1 },
  ]),
  loading: { overview: false, shipped: false, flow: false, efficiency: false },
  retry: mocks.retry,
});

beforeEach(() => {
  mocks.retry.mockClear();
  mocks.state.navigate.mockClear();
  mocks.useImpactMetrics.mockImplementation(() => mocks.metrics);
  mocks.metrics = buildMetrics();
});

afterEach(cleanup);

const renderStudio = (onClose = vi.fn()) =>
  render(
    <ImpactStudio
      workspaceId={'workspace-1' as never}
      workspaceName="Northwind"
      onClose={onClose}
    />,
  );

describe('ImpactStudio', () => {
  it('opens on a summary sentence built from the numbers', () => {
    renderStudio();

    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName === 'P' &&
          node.textContent ===
            'In the last 30 days Goodboy ran 4 sessions in Northwind, merged 3 pull requests and spent $12.50. Workflows ran 75% of sessions.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeDefined();
  });

  it('leaves spend out of the sentence when nothing was measured', () => {
    const base = buildMetrics();
    mocks.metrics = {
      ...base,
      overview: result({ ...base.overview.data!, spendUsd: null, spendSessions: [] }),
    };
    renderStudio();

    expect(screen.queryByText('$0')).toBeNull();
    expect(screen.queryByText(/spent/)).toBeNull();
  });

  it('opens the tab that explains a tile, not a session', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: /pull requests merged/i }));
    expect(screen.getByText('PR funnel')).toBeDefined();
    expect(mocks.state.navigate).not.toHaveBeenCalled();
  });

  it('names each change in words next to its tile', () => {
    renderStudio();

    expect(screen.getByText('up 50%')).toBeDefined();
    expect(screen.getByText('down 1.0h')).toBeDefined();
  });

  it('opens a session from the sessions that shipped the most', () => {
    const onClose = vi.fn();
    renderStudio(onClose);

    fireEvent.click(screen.getByRole('button', { name: /ship impact studio/i }));
    expect(mocks.state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId }),
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the empty state when the window has no sessions', () => {
    const base = buildMetrics();
    mocks.metrics = {
      ...base,
      overview: result({ ...base.overview.data!, sessionCount: 0, orchestratedSessions: 0 }),
    };
    renderStudio();

    expect(screen.getByText('Impact fills in as sessions finish.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start a session' })).toBeDefined();
  });

  it('switches to Shipped and renders its key outcome rows', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Shipped' }));
    expect(screen.getByText('PR funnel')).toBeDefined();
    expect(screen.getByText('Published drafts: 4')).toBeDefined();
    expect(screen.getByText('src/hot.ts')).toBeDefined();
    expect(screen.getByText('$3.50')).toBeDefined();
  });

  it('omits the pull request spend figure when the pull request has no telemetry', () => {
    const base = buildMetrics();
    const prs = base.pullRequests.data!;
    mocks.metrics = {
      ...base,
      pullRequests: result({
        ...prs,
        entries: prs.entries.map((entry) => ({ ...entry, spendUsd: null })),
      }),
    };
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Shipped' }));
    expect(screen.getByText('PR funnel')).toBeDefined();
    expect(screen.queryByText('$3.50')).toBeNull();
    expect(screen.queryByText('$0')).toBeNull();
  });

  it('switches to Flow and renders tempo and blocker rows', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));
    expect(screen.getByText('agent duration by kind')).toBeDefined();
    expect(screen.getByText('Waiting on open questions')).toBeDefined();
    expect(screen.getByText('p90 4.0h')).toBeDefined();
  });

  it('reports every scope change, so the navigation address stays honest', () => {
    const onScopeChange = vi.fn();
    render(
      <ImpactStudio
        workspaceId={'workspace-1' as never}
        onClose={vi.fn()}
        onScopeChange={onScopeChange}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));

    expect(onScopeChange).toHaveBeenCalledWith({ kind: 'flow' });
  });

  it('draws failed flow metrics as not loaded instead of zero', () => {
    mocks.metrics = {
      ...buildMetrics(),
      flowHealth: { data: null, error: new Error('database is locked') },
    };
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));
    expect(screen.getAllByText('not loaded')).toHaveLength(4);
    expect(screen.queryByText('0 answered')).toBeNull();
    expect(screen.getAllByText('\u2013').length).toBeGreaterThanOrEqual(4);
  });

  it('folds efficiency into the spend tab', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Spend' }));
    expect(screen.getByText('cache reuse by provider')).toBeDefined();
    expect(screen.getByText('context growth per turn')).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'Efficiency' })).toBeNull();
  });

  it('updates the query window from the header toggle', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));
    expect(mocks.useImpactMetrics).toHaveBeenLastCalledWith({
      workspaceId: 'workspace-1',
      windowId: 'last7',
    });
  });

  it('renders a danger error strip and retries its scope', () => {
    mocks.metrics = {
      ...buildMetrics(),
      overview: { data: null, error: new Error('database unavailable') },
    };
    renderStudio();

    expect(screen.getByRole('alert').textContent).toContain('database unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.retry).toHaveBeenCalledWith('overview');
  });
});
