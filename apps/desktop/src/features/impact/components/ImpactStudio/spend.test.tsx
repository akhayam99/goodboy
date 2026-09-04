// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { ImpactMetrics } from '../../hooks/useImpactMetrics';

const { state, mocks } = vi.hoisted(() => ({
  mocks: { useImpactMetrics: vi.fn() },
  state: {
    currentSessionId: 'session-1',
    sessions: [{ id: 'session-1', goal: 'build the feature' }] as ReadonlyArray<{
      id: string;
      goal: string;
    }>,
    sessionTelemetry: {} as Record<string, ReadonlyArray<unknown>>,
    providerSpendBreakdown: [
      { provider: 'anthropic', spentUsd: 3, capUsd: 10, pct: 0.3 },
    ] as ReadonlyArray<{
      provider: string;
      spentUsd: number;
      capUsd: number | null;
      pct: number;
    }>,
    budgetAlerts: [] as ReadonlyArray<unknown>,
    budgetRules: [] as ReadonlyArray<unknown>,
    sessionBudgets: {} as Record<string, { softCapUsd: number }>,
    currentWorkspaceId: 'workspace-1',
    setCurrentSession: vi.fn(),
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
}));

vi.mock('../../hooks/useImpactMetrics', () => ({
  useImpactMetrics: mocks.useImpactMetrics,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessions: () => state.sessions,
}));

import { ImpactStudio } from './index';
import type { ImpactScope } from '../../lib';

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
  render(
    <ImpactStudio
      workspaceId={'workspace-1' as WorkspaceId}
      workspaceName="Goodboy"
      initialScope={initialScope}
      onClose={onClose}
    />,
  );

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
  it('groups providers and sessions in the one rail, under a single window control', () => {
    renderStudio();

    expect(screen.getByRole('tablist', { name: 'Impact window' })).toBeDefined();
    expect(screen.getByText('spend by provider')).toBeDefined();
    expect(screen.getByText('spend by session')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeDefined();
  });

  it('switches to a provider scope from the rail and shows its spend breakdown', () => {
    renderStudio();

    const [claudeRow] = screen.getAllByRole('button', { name: /claude/i });
    fireEvent.click(claudeRow!);
    expect(screen.getByText(/total spend/i)).toBeDefined();
  });

  it('opens the provider panel when the studio is asked for a provider scope', () => {
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    expect(screen.getByText(/total spend/i)).toBeDefined();
    expect(screen.getByLabelText(/monthly cap/i)).toBeDefined();
  });

  it('opens the session panel when the studio is asked for a session scope', () => {
    renderStudio({ initialScope: { kind: 'session', sessionId: 'session-1' as SessionId } });

    expect(screen.getAllByText(/build the feature/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/session cost/i)).toBeDefined();
    expect(screen.getByText(/cost per turn/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'recent' })).toBeDefined();
  });

  it('authors a new provider cap via saveBudgetRule', () => {
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    fireEvent.change(screen.getByLabelText(/monthly cap/i), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /set cap/i }));
    expect(state.saveBudgetRule).toHaveBeenCalledWith({
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 50,
      alertThresholdPct: 80,
      extraTokensBudget: null,
    });
    expect(state.deleteBudgetRule).not.toHaveBeenCalled();
  });

  it('edits an existing provider cap as delete then save', async () => {
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

    fireEvent.change(screen.getByLabelText(/monthly cap/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /update cap/i }));
    await Promise.resolve();
    expect(state.deleteBudgetRule).toHaveBeenCalledWith('rule-1');
    expect(state.saveBudgetRule).toHaveBeenCalledWith({
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 25,
      alertThresholdPct: 90,
      extraTokensBudget: 5,
    });
  });

  it('edits the threshold as delete then save, keeping the cap intact', async () => {
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

    fireEvent.change(screen.getByLabelText('alert threshold percent'), {
      target: { value: '60' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update threshold/i }));
    await Promise.resolve();
    expect(state.deleteBudgetRule).toHaveBeenCalledWith('rule-1');
    expect(state.saveBudgetRule).toHaveBeenCalledWith({
      provider: 'anthropic',
      period: 'monthly',
      capUsd: 10,
      alertThresholdPct: 60,
      extraTokensBudget: 5,
    });
  });

  it('removes a provider cap via deleteBudgetRule', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(state.deleteBudgetRule).toHaveBeenCalledWith('rule-1');
  });

  it('sets a session soft cap via setSessionBudget', () => {
    renderStudio({ initialScope: { kind: 'session', sessionId: 'session-1' as SessionId } });

    fireEvent.change(screen.getByLabelText(/session soft cap/i), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: /set cap/i }));
    expect(state.setSessionBudget).toHaveBeenCalledWith('session-1', 12.5);
  });

  it('renders a failed spend load and retries it', async () => {
    state.loadBudgetAlerts.mockRejectedValueOnce(new Error('alerts unavailable'));
    renderStudio();

    expect((await screen.findByRole('alert')).textContent).toContain('alerts unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.loadBudgetAlerts).toHaveBeenCalledTimes(2);
  });

  it('opens the session from a turn row', () => {
    const onClose = vi.fn();
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' }, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Open session build the feature' }));
    expect(state.setCurrentSession).toHaveBeenCalledWith('session-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves every model row unmarked and stays silent when the whole provider is priced', () => {
    renderStudio({ initialScope: { kind: 'provider', provider: 'anthropic' } });

    expect(screen.queryByText(/cannot include them/i)).toBeNull();
    expect(screen.queryByText('unpriced')).toBeNull();
    expect(screen.queryByText('approx')).toBeNull();
  });

  it('marks the unpriced model row and names how many turns a cap would miss', () => {
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
      screen.getByText('No price for 1 of 3 turns, so a cap cannot include them'),
    ).toBeDefined();
    expect(screen.getAllByText('unpriced')).toHaveLength(1);
    expect(screen.queryByText('approx')).toBeNull();
  });

  it('marks an approximate model row without calling it unpriced or warning about the cap', () => {
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
      screen.getByText('No price for 2 of 3 turns, so a cap cannot include them'),
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
