// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import type { ImpactMetrics } from '../../hooks/useImpactMetrics';

const { state, mocks } = vi.hoisted(() => {
  const sessions: ReadonlyArray<{ id: string; goal: string }> = [
    { id: 'session-1', goal: 'build the feature' },
  ];
  const sessionTelemetry: Record<string, ReadonlyArray<unknown>> = {};
  const providerSpendBreakdown: ReadonlyArray<{ provider: string; spentUsd: number }> = [
    { provider: 'anthropic', spentUsd: 3 },
  ];
  const providerBudgetStatus: Record<string, unknown> = {};
  const budgetAlerts: ReadonlyArray<unknown> = [];
  const budgetRules: ReadonlyArray<unknown> = [];
  const sessionBudgets: Record<string, { softCapUsd: number }> = {};
  return {
    mocks: { useImpactMetrics: vi.fn() },
    state: {
      currentSessionId: 'session-1',
      sessions,
      sessionTelemetry,
      providerSpendBreakdown,
      providerBudgetStatus,
      budgetAlerts,
      budgetRules,
      sessionBudgets,
      clearSessionBudget: vi.fn(),
      currentWorkspaceId: 'workspace-1',
      navigate: vi.fn(),
      loadBudgetRules: vi.fn(),
      loadBudgetAlerts: vi.fn(),
      loadSessionTelemetry: vi.fn(),
      loadSessionBudget: vi.fn(),
      dismissBudgetAlert: vi.fn(),
      saveBudgetRule: vi.fn(),
      deleteBudgetRule: vi.fn(),
      setSessionBudget: vi.fn(),
      refreshProviderSpendBreakdown: vi.fn(),
    },
  };
});

vi.mock('../../hooks/useImpactMetrics', () => ({
  useImpactMetrics: mocks.useImpactMetrics,
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessions: () => state.sessions,
  useTelemetryForSessions: () => state.sessionTelemetry,
  useDormantSpend: () => [],
}));

import { ImpactStudio } from './index';
import type { ImpactScope } from '../../lib';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-1' });

const EMPTY_RESULT = { data: null, error: null };

const emptyMetrics = (): ImpactMetrics =>
  ({
    overview: EMPTY_RESULT,
    pullRequests: EMPTY_RESULT,
    reviews: EMPTY_RESULT,
    externalTasks: EMPTY_RESULT,
    agentDurations: EMPTY_RESULT,
    flowHealth: EMPTY_RESULT,
    cacheEfficiency: EMPTY_RESULT,
    contextGrowth: EMPTY_RESULT,
    turns: EMPTY_RESULT,
    nudges: EMPTY_RESULT,
    loading: { overview: false, shipped: false, flow: false, efficiency: false },
    retry: vi.fn(),
  }) satisfies ImpactMetrics;

type TelemetryRecordParams = {
  readonly id: string;
  readonly model: string;
  readonly costUsd: number;
  readonly recordedAt: string;
  readonly provider?: string;
};

const telemetryRecord = ({
  id,
  model,
  costUsd,
  recordedAt,
  provider = 'codex',
}: TelemetryRecordParams) => ({
  id,
  runId: `run-${id}`,
  sessionId: 'session-1',
  kind: 'turn',
  provider,
  model,
  inputTokens: 40,
  outputTokens: 60,
  estimatedCostUsd: costUsd,
  recordedAt,
});

type RenderParams = {
  readonly initialScope?: ImpactScope;
  readonly onClose?: () => void;
};

const renderStudio = ({ initialScope, onClose = vi.fn() }: RenderParams = {}) =>
  render(<ImpactStudio workspaceId={WORKSPACE_ID} initialScope={initialScope} onClose={onClose} />);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useImpactMetrics.mockImplementation(() => emptyMetrics());
  state.loadBudgetRules.mockResolvedValue(undefined);
  state.loadBudgetAlerts.mockResolvedValue(undefined);
  state.loadSessionTelemetry.mockResolvedValue(undefined);
  state.loadSessionBudget.mockResolvedValue(undefined);
  state.budgetRules = [];
  state.sessionBudgets = {};
  state.sessionTelemetry = {
    'session-1': [
      {
        id: 't1',
        runId: 'r1',
        sessionId: 'session-1',
        kind: 'turn',
        provider: 'anthropic',
        model: 'claude-opus-4-8',
        inputTokens: 50,
        outputTokens: 100,
        estimatedCostUsd: 1.5,
        recordedAt: new Date().toISOString(),
      },
    ],
  };
});

afterEach(cleanup);

describe('Impact studio spend scopes', () => {
  it('keeps providers and sessions in the spend tab, under one window control', () => {
    renderStudio({ initialScope: { kind: 'spend' } });

    expect(screen.getByRole('tablist', { name: 'Impact window' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Spend', selected: true })).toBeDefined();
    expect(screen.getByText('Sessions by spend')).toBeDefined();
    expect(screen.queryByText('spend by provider')).toBeNull();
  });

  it('anchors a provider inside spend and goes back to all spend', () => {
    renderStudio({ initialScope: { kind: 'spend' } });

    const [claudeRow] = screen.getAllByRole('button', { name: /claude/i });
    fireEvent.click(claudeRow!);
    expect(screen.getByText(/spent, 30 days/i)).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Spend', selected: true })).toBeDefined();
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByText('Claude')).toBeDefined();
    fireEvent.click(within(trail).getByRole('button', { name: 'Spend' }));
    expect(screen.queryByText(/spent, 30 days/i)).toBeNull();
    expect(screen.getByText('Sessions by spend')).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('returns from a session record to the overview through the Impact crumb', () => {
    renderStudio({ initialScope: { kind: 'session', sessionId: SESSION_ID } });

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByText('build the feature')).toBeDefined();
    fireEvent.click(within(trail).getByRole('button', { name: 'Impact' }));
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeDefined();
    expect(screen.queryByText('Session spend')).toBeNull();
  });

  it('closes the studio on Esc from a spend record', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' }, onClose });

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('anchors a session inside spend from its row', () => {
    renderStudio({ initialScope: { kind: 'spend' } });

    fireEvent.click(screen.getByRole('button', { name: /build the feature/i }));
    expect(screen.getByText('Session spend')).toBeDefined();
  });

  it('opens the provider panel when the studio is asked for a provider scope', () => {
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    expect(screen.getByText(/spent, 30 days/i)).toBeDefined();
    expect(screen.getByLabelText('Monthly limit')).toBeDefined();
  });

  it('stacks the crumb trail above a record so the panel keeps the whole width', () => {
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    const view = document.querySelector<HTMLElement>('[data-record-view]');
    if (view === null) {
      throw new Error('the provider record has no view container');
    }
    within(view).getByLabelText('Monthly limit');
  });

  it('puts the crumb trail in its own row above the panel', () => {
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    const view = document.querySelector<HTMLElement>('[data-record-view]');
    const row = view?.firstElementChild ?? null;
    expect(row?.textContent).toContain('Spend');
    expect(row?.contains(screen.getByLabelText('Monthly limit'))).toBe(false);
  });

  it('opens the session panel when the studio is asked for a session scope', () => {
    renderStudio({ initialScope: { kind: 'session', sessionId: SESSION_ID } });

    expect(screen.getAllByText(/build the feature/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Session spend')).toBeDefined();
    expect(screen.getByText(/cost per turn/i)).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Recent' })).toBeDefined();
  });

  it('authors a new provider limit via saveBudgetRule', () => {
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    fireEvent.change(screen.getByLabelText('Monthly limit'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));
    expect(state.saveBudgetRule).toHaveBeenCalledWith({
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 50,
      alertThresholdPct: 80,
      extraTokensBudget: null,
    });
    expect(state.deleteBudgetRule).not.toHaveBeenCalled();
  });

  it('edits an existing provider limit under the same rule identity', async () => {
    state.budgetRules = [
      {
        id: 'rule-1',
        provider: 'anthropic',
        period: 'monthly',
        capUsd: 10,
        alertThresholdPct: 90,
        extraTokensBudget: 5,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ];
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    fireEvent.change(screen.getByLabelText('Monthly limit'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));
    await Promise.resolve();
    expect(state.deleteBudgetRule).not.toHaveBeenCalled();
    expect(state.saveBudgetRule).toHaveBeenCalledWith({
      id: 'rule-1',
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 25,
      alertThresholdPct: 90,
      extraTokensBudget: 5,
      createdAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('edits the threshold under the same rule identity', async () => {
    state.budgetRules = [
      {
        id: 'rule-1',
        provider: 'anthropic',
        period: 'monthly',
        capUsd: 10,
        alertThresholdPct: 90,
        extraTokensBudget: 5,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ];
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    fireEvent.change(screen.getByLabelText('Warn at percent of the limit'), {
      target: { value: '60' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));
    await Promise.resolve();
    expect(state.deleteBudgetRule).not.toHaveBeenCalled();
    expect(state.saveBudgetRule).toHaveBeenCalledWith({
      id: 'rule-1',
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 10,
      alertThresholdPct: 60,
      extraTokensBudget: 5,
      createdAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('removes a provider limit via deleteBudgetRule after the popover confirm', () => {
    state.budgetRules = [
      {
        id: 'rule-1',
        provider: 'anthropic',
        period: 'monthly',
        capUsd: 10,
        alertThresholdPct: 80,
        extraTokensBudget: null,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ];
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    fireEvent.click(screen.getByRole('button', { name: 'Remove limit' }));
    expect(state.deleteBudgetRule).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /^Remove the .*10.* limit\?$/ })).getByRole(
        'button',
        {
          name: /remove/i,
        },
      ),
    );
    expect(state.deleteBudgetRule).toHaveBeenCalledWith('rule-1');
  });

  it('sets a session spend cap via setSessionBudget', async () => {
    renderStudio({ initialScope: { kind: 'session', sessionId: SESSION_ID } });

    fireEvent.click(screen.getByRole('button', { name: 'Set limit' }));
    fireEvent.change(screen.getByLabelText('Limit in dollars'), {
      target: { value: '12.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(state.setSessionBudget).toHaveBeenCalledWith('session-1', 12.5, 'pause'),
    );
  });

  it('renders a failed spend load and retries it', async () => {
    state.loadBudgetAlerts.mockRejectedValueOnce(new Error('alerts unavailable'));
    renderStudio({ initialScope: { kind: 'spend' } });

    expect((await screen.findByRole('alert')).textContent).toContain('alerts unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.loadBudgetAlerts).toHaveBeenCalledTimes(2);
  });

  it('opens the session from a turn row', () => {
    const onClose = vi.fn();
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' }, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Open session build the feature' }));
    expect(state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: SESSION_ID }),
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves every model row unmarked and stays silent when the whole provider is priced', () => {
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    expect(screen.queryByText(/cannot include them/i)).toBeNull();
    expect(screen.queryByText('unpriced')).toBeNull();
    expect(screen.queryByText('approx')).toBeNull();
  });

  it('marks the unpriced model row and names how many turns a limit would miss', () => {
    const now = new Date().toISOString();
    state.sessionTelemetry = {
      'session-1': [
        telemetryRecord({ id: 'c1', model: 'gpt-5.6-sol', costUsd: 2, recordedAt: now }),
        telemetryRecord({ id: 'c2', model: 'gpt-5.6-sol', costUsd: 3, recordedAt: now }),
        telemetryRecord({ id: 'c3', model: 'mystery-codex', costUsd: 0, recordedAt: now }),
      ],
    };
    renderStudio({ initialScope: { kind: 'provider', provider: 'codex' } });

    expect(
      screen.getByText("No price for 1 of 3 turns, so a limit can't include them"),
    ).toBeDefined();
    expect(screen.getAllByText('unpriced')).toHaveLength(1);
    expect(screen.queryByText('approx')).toBeNull();
  });

  it('marks an approximate model row without calling it unpriced or warning about the limit', () => {
    const now = new Date().toISOString();
    state.sessionTelemetry = {
      'session-1': [
        telemetryRecord({
          id: 'x1',
          provider: 'cursor',
          model: 'composer-2.5',
          costUsd: 4,
          recordedAt: now,
        }),
      ],
    };
    renderStudio({ initialScope: { kind: 'provider', provider: 'cursor' } });

    expect(screen.getAllByText('approx')).toHaveLength(1);
    expect(screen.queryByText('unpriced')).toBeNull();
    expect(screen.queryByText(/cannot include them/i)).toBeNull();
  });

  it('counts only the zero-cost turns when a provider reports cost inconsistently', () => {
    const now = new Date().toISOString();
    state.sessionTelemetry = {
      'session-1': [
        telemetryRecord({
          id: 'm1',
          provider: 'opencode',
          model: 'big-pickle',
          costUsd: 0.5,
          recordedAt: now,
        }),
        telemetryRecord({
          id: 'm2',
          provider: 'opencode',
          model: 'big-pickle',
          costUsd: 0,
          recordedAt: now,
        }),
        telemetryRecord({
          id: 'm3',
          provider: 'opencode',
          model: 'big-pickle',
          costUsd: 0,
          recordedAt: now,
        }),
      ],
    };
    renderStudio({ initialScope: { kind: 'provider', provider: 'opencode' } });

    expect(
      screen.getByText("No price for 2 of 3 turns, so a limit can't include them"),
    ).toBeDefined();
  });

  it('filters spend telemetry with the studio window control', () => {
    state.sessionTelemetry = {
      'session-1': [
        ...(state.sessionTelemetry['session-1'] ?? []),
        {
          id: 't-old',
          runId: 'r-old',
          sessionId: 'session-1',
          kind: 'turn',
          provider: 'anthropic',
          model: 'legacy-budget-model',
          inputTokens: 20,
          outputTokens: 30,
          estimatedCostUsd: 2,
          recordedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
    };
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    expect(screen.queryByText('Legacy Budget Model')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));
    expect(screen.getAllByText('Legacy Budget Model').length).toBeGreaterThan(0);
  });
});
