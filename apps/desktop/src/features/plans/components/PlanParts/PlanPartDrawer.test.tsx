// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    navigate: vi.fn(),
    loadAgentTranscript: vi.fn(async () => undefined),
    plans: [] as ReadonlyArray<unknown>,
  },
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionPlans: () => state.plans,
  useSessionOpenQuestions: () => [],
}));

import { PlanPartDrawer } from './PlanPartDrawer';

const PLAN = {
  id: 'plan-1',
  sessionId: 'sess-1',
  agentId: 'agent-planner',
  title: 'Backfill the settled batches',
  bodyMd: '',
  status: 'active',
  createdAt: '2026-09-14T19:34:00.000Z',
  updatedAt: '2026-09-14T19:34:00.000Z',
  consumptionCount: 0,
  clusters: [
    { title: 'Add a dry run', instructions: 'Add `dryRun` to the job.' },
    {
      title: 'Backfill settled batches behind a flag',
      instructions: 'Walk settled batches oldest first.',
      doneWhen: ['run the backfill in dry run', 'see totals match for 4469 to 4471'],
      touches: ['ledger-core/src/settlement/backfill.ts'],
      routingProposal: {
        pick: { provider: 'anthropic', model: 'claude-sonnet-5', effort: 'high' },
        reason: 'A contained change in one module',
        source: 'agent',
        profile: 'implementation',
      },
    },
  ],
};

afterEach(cleanup);

describe('PlanPartDrawer', () => {
  it('shows the instructions, the checks, the files and the proposed routing of one part', () => {
    state.plans = [PLAN];
    render(
      <PlanPartDrawer
        sessionId={'sess-1' as never}
        planId={'plan-1' as never}
        index={1}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Part 2 of 2' })).toBeDefined();
    expect(screen.getByText('Walk settled batches oldest first.')).toBeDefined();
    expect(screen.getByText('see totals match for 4469 to 4471')).toBeDefined();
    expect(screen.getByText('ledger-core/src/settlement/backfill.ts')).toBeDefined();
    expect(screen.getByText('A contained change in one module')).toBeDefined();
  });

  it('says a part without a proposal runs on Auto', () => {
    state.plans = [PLAN];
    render(
      <PlanPartDrawer
        sessionId={'sess-1' as never}
        planId={'plan-1' as never}
        index={0}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText('Auto')).toBeDefined();
  });

  it('opens the subagent that carries a part once the plan ran', () => {
    state.plans = [
      {
        ...PLAN,
        status: 'consumed',
        consumptionCount: 1,
        lastConsumer: { agentId: 'agent-impl', name: 'Implementer 3' },
      },
    ];
    state.sessionPhaseRuns = {
      'sess-1': [
        { id: 'agent-impl', name: 'Implementer 3', status: 'running', ordinal: 1 },
        {
          id: 'agent-a',
          name: 'Add a dry run',
          parentAgentId: 'agent-impl',
          status: 'completed',
          ordinal: 2,
        },
        {
          id: 'agent-b',
          name: 'Backfill',
          parentAgentId: 'agent-impl',
          status: 'running',
          ordinal: 3,
        },
      ],
    };
    render(
      <PlanPartDrawer
        sessionId={'sess-1' as never}
        planId={'plan-1' as never}
        index={1}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText('Running as Backfill')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(state.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: 'sess-1', agentId: 'agent-b' },
    });
  });
});
