// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  PlanConsumption,
  PlanConsumptionId,
  PlanId,
  PlanWithCount,
  SessionId,
  TelemetryRecord,
  WorkflowRunId,
} from '@goodboy/types';
import type { AgentKind } from '../../../../../features/session/agent-kind';
import { CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';

const storeState = vi.hoisted(() => ({
  plans: [] as ReadonlyArray<PlanWithCount>,
  planConsumptions: {} as Record<PlanId, ReadonlyArray<PlanConsumption>>,
}));

vi.mock('../../../../../store', () => ({
  agentHasUnread: () => false,
  useAppStore: <T,>(
    selector: (state: { planConsumptions: Record<PlanId, ReadonlyArray<PlanConsumption>> }) => T,
  ) => selector(storeState),
  useSessionPlans: () => storeState.plans,
}));

import { WorkflowStepRow } from './WorkflowStepRow';

const SID = 'sess-1' as SessionId;

const run = {
  id: 'step-agent-1' as AgentId,
  sessionId: SID,
  ordinal: 0,
  name: 'implement the slice',
  status: 'completed',
  startedAt: '2026-05-28T00:00:00Z',
  completedAt: '2026-05-28T00:03:00Z',
} as Agent;

const telemetry = {
  runId: 'run-1',
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  inputTokens: 10,
  outputTokens: 2,
  estimatedCostUsd: 0.3,
  recordedAt: '2026-01-01T00:00:00.000Z',
} as TelemetryRecord;

type Overrides = {
  readonly ranAlready?: boolean;
  readonly isPendingFuture?: boolean;
  readonly kind?: AgentKind;
  readonly runOverride?: Agent;
};

const renderRow = ({
  ranAlready = true,
  isPendingFuture = false,
  kind = 'implementer',
  runOverride,
}: Overrides = {}) =>
  render(
    <WorkflowStepRow
      run={
        runOverride ??
        (isPendingFuture
          ? ({ ...run, status: 'pending', startedAt: undefined, completedAt: undefined } as Agent)
          : run)
      }
      kind={kind}
      index={0}
      resolvedModel="claude-opus-4-5"
      resolvedProvider="anthropic"
      isActionable={false}
      blockReason={null}
      isSelected={false}
      isTaskActive
      isEditing={false}
      telemetry={ranAlready ? telemetry : null}
      aggregate={
        ranAlready ? { inputTokens: 900, outputTokens: 90, estimatedCostUsd: 1.1, turns: 5 } : null
      }
      contextUsage={
        ranAlready
          ? [
              {
                provider: 'anthropic',
                model: 'claude-sonnet-4-5',
                inputTokens: 900,
                outputTokens: 90,
                contextTokens: 990,
              },
            ]
          : []
      }
      turns={ranAlready ? 5 : 0}
      turnsLoading={false}
      onStart={() => undefined}
      onForceStart={() => undefined}
      onSelect={() => undefined}
      onRenameStart={() => undefined}
      onRenameCommit={() => undefined}
      onRenameCancel={() => undefined}
    />,
  );

afterEach(() => {
  cleanup();
  storeState.plans = [];
  storeState.planConsumptions = {};
});

describe('WorkflowStepRow', () => {
  it('shows the full metric picture without being selected', () => {
    const { container } = renderRow();
    expect(screen.getByTestId('agent-metrics-inline')).toBeTruthy();
    expect(screen.getByText('Sonnet 4.5')).toBeTruthy();
    expect(screen.getByText('5t')).toBeTruthy();
    expect(screen.getByText(/ctx \d+%/)).toBeTruthy();
    expect(screen.getByTitle('In: 900 tokens (cumulative)')).toBeTruthy();
    expect(container.querySelectorAll('[title*="context:"]').length).toBeGreaterThan(0);
  });

  it('prints the model and the duration exactly once', () => {
    const { container } = renderRow();
    expect(screen.getAllByText('Sonnet 4.5')).toHaveLength(1);
    expect(container.querySelectorAll('[title^="In: "]')).toHaveLength(1);
    expect(screen.getAllByTitle(/^Started .*28.*2026/)).toHaveLength(1);
  });

  it('names the planned model and stays quiet for a step that has not run', () => {
    renderRow({ ranAlready: false, isPendingFuture: true });
    expect(screen.getByText('Opus 4.5')).toBeTruthy();
    expect(screen.getByTestId('agent-metrics-inline').className).toContain('opacity-60');
    expect(screen.queryByTestId('agent-metrics-block')).toBeNull();
  });

  it('opens the plan created by a planner step', () => {
    const plan = {
      id: 'plan-1' as PlanId,
      sessionId: SID,
      agentId: run.id,
      title: 'Authentication migration strategy',
      bodyMd: 'body',
      status: 'active',
      createdAt: '2026-07-27T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-07-27T00:00:00.000Z' as IsoDateTime,
      consumptionCount: 0,
    } satisfies PlanWithCount;
    storeState.plans = [plan];
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-plan-studio', onOpen);

    renderRow({ kind: 'planner' });
    const planButton = screen.getByRole('button', { name: /open plan:/i });
    const planTint = tintClasses(CONCEPT_TONE.plans);
    expect(planButton.className).toContain(planTint.bgSoft);
    expect(planButton.className).toContain(planTint.borderSoft);
    fireEvent.click(planButton);

    expect(screen.getByRole('button', { name: `Open plan: ${plan.title}` }).textContent).toContain(
      'Plan',
    );
    const event = onOpen.mock.calls[0]?.[0];
    if (!(event instanceof CustomEvent)) {
      throw new Error('expected a plan studio event');
    }
    expect(event.detail).toEqual({
      sessionId: SID,
      planId: plan.id,
    });
    window.removeEventListener('goodboy:open-plan-studio', onOpen);
  });

  it('shows the plan consumed by an implementation step', () => {
    const workflowRunId = 'workflow-run-1' as WorkflowRunId;
    const consumer = { ...run, workflowRunId } satisfies Agent;
    const plan = {
      id: 'plan-2' as PlanId,
      sessionId: SID,
      agentId: 'planner-1' as AgentId,
      workflowRunId,
      title: 'Database routing plan',
      bodyMd: 'body',
      status: 'active',
      createdAt: '2026-07-27T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-07-27T00:00:00.000Z' as IsoDateTime,
      consumptionCount: 1,
    } satisfies PlanWithCount;
    storeState.plans = [plan];
    storeState.planConsumptions = {
      [plan.id]: [
        {
          id: 'consumption-1' as PlanConsumptionId,
          planId: plan.id,
          agentId: consumer.id,
          agentName: consumer.name,
          consumedAt: '2026-07-27T00:01:00.000Z' as IsoDateTime,
        },
      ],
    };

    renderRow({ kind: 'implementer', runOverride: consumer });

    expect(screen.getByRole('button', { name: /open from plan:/i }).textContent).toContain(
      'From plan',
    );
    expect(screen.getByRole('button', { name: `Open from plan: ${plan.title}` })).toBeTruthy();
  });

  it('falls back to the latest run plan for a completed consumer without consumptions', () => {
    const workflowRunId = 'workflow-run-1' as WorkflowRunId;
    const consumer = { ...run, workflowRunId } satisfies Agent;
    const plan = {
      id: 'plan-3' as PlanId,
      sessionId: SID,
      agentId: 'planner-1' as AgentId,
      workflowRunId,
      title: 'Latest run plan',
      bodyMd: 'body',
      status: 'active',
      createdAt: '2026-07-27T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-07-27T00:00:00.000Z' as IsoDateTime,
      consumptionCount: 0,
    } satisfies PlanWithCount;
    storeState.plans = [plan];

    renderRow({ kind: 'generic', runOverride: consumer });

    expect(screen.getByRole('button', { name: `Open from plan: ${plan.title}` })).toBeTruthy();
  });
});
