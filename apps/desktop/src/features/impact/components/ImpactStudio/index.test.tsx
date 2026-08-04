// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { ImpactMetrics } from '../../hooks/useImpactMetrics';

const mocks = vi.hoisted(() => ({
  metrics: null as unknown as ImpactMetrics,
  retry: vi.fn(),
  setCurrentSession: vi.fn(),
  useImpactMetrics: vi.fn(),
}));

vi.mock('../../hooks/useImpactMetrics', () => ({
  useImpactMetrics: mocks.useImpactMetrics,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (state: { setCurrentSession: typeof mocks.setCurrentSession }) => T,
  ) => selector({ setCurrentSession: mocks.setCurrentSession }),
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
  mocks.setCurrentSession.mockClear();
  mocks.useImpactMetrics.mockImplementation(() => mocks.metrics);
  mocks.metrics = buildMetrics();
});

afterEach(cleanup);

describe('ImpactStudio', () => {
  it('renders the overview outcome verdict and opens session drill-down', () => {
    const onClose = vi.fn();
    render(
      <ImpactStudio
        workspaceId={'workspace-1' as never}
        workspaceName="Goodboy"
        onClose={onClose}
      />,
    );

    expect(screen.getByText('orchestrated')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
    expect(screen.getByText(/longest session wall-clock/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /ship impact studio/i }));
    expect(mocks.setCurrentSession).toHaveBeenCalledWith('session-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('switches to Shipped and renders its key outcome rows', () => {
    render(
      <ImpactStudio
        workspaceId={'workspace-1' as never}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Shipped' }));
    expect(screen.getByText('PR funnel')).toBeDefined();
    expect(screen.getByText('Published drafts: 4')).toBeDefined();
    expect(screen.getByText('src/hot.ts')).toBeDefined();
  });

  it('switches to Flow and renders tempo and blocker rows', () => {
    render(
      <ImpactStudio
        workspaceId={'workspace-1' as never}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Flow' }));
    expect(screen.getByText('agent duration by kind')).toBeDefined();
    expect(screen.getByText('Waiting on open questions')).toBeDefined();
    expect(screen.getByText('p90 4.0h')).toBeDefined();
  });

  it('switches to Efficiency and dispatches the Budget Studio link', () => {
    const onBudget = vi.fn();
    window.addEventListener('goodboy:open-budget-studio', onBudget);
    render(
      <ImpactStudio
        workspaceId={'workspace-1' as never}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Efficiency' }));
    expect(screen.getByText('cache reuse by provider')).toBeDefined();
    expect(screen.getByText('context growth per turn')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /spend and caps live in budget/i }));
    expect(onBudget).toHaveBeenCalled();
    window.removeEventListener('goodboy:open-budget-studio', onBudget);
  });

  it('updates the query window from the header toggle', () => {
    render(
      <ImpactStudio
        workspaceId={'workspace-1' as never}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));
    expect(mocks.useImpactMetrics).toHaveBeenLastCalledWith({
      workspaceId: 'workspace-1',
      windowId: 'all',
    });
  });

  it('renders a danger error strip and retries its scope', () => {
    mocks.metrics = {
      ...buildMetrics(),
      overview: { data: null, error: new Error('database unavailable') },
    };
    render(
      <ImpactStudio
        workspaceId={'workspace-1' as never}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('database unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.retry).toHaveBeenCalledWith('overview');
  });
});
