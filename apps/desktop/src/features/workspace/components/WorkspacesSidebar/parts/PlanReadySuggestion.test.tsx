// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PlanWithCount, Session } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    plans: [
      {
        id: 'plan-1',
        sessionId: 'session-1',
        agentId: 'planner-1',
        title: 'Unify the detail surfaces',
        bodyMd: '',
        status: 'active',
        createdAt: '2026-08-18T08:00:00.000Z',
        updatedAt: '2026-08-18T08:00:00.000Z',
        consumptionCount: 0,
      },
    ] as unknown as ReadonlyArray<PlanWithCount>,
    sessionPhaseRuns: {},
    phaseTemplates: {},
    runPlan: vi.fn(async () => 'implementer-1'),
  },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
  useSessionOpenQuestions: () => [],
  useSessionPlans: () => state.plans,
}));

vi.mock('../../../../../shared/hooks/useAgentStartedToast', () => ({
  useAgentStartedToast: () => vi.fn(),
}));

vi.mock('../../../../suggestions', () => ({
  useSessionSuggestions: () => [
    {
      id: 'plan-ready:plan-1',
      kind: 'plan-ready',
      priority: 20,
      title: 'Unify the detail surfaces',
      detail: 'Ready to implement',
      sessionId: 'session-1',
      payload: { planId: 'plan-1' },
    },
  ],
}));

import { PlanReadySuggestion } from './PlanReadySuggestion';

const SESSION = {
  id: 'session-1',
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

afterEach(cleanup);

describe('PlanReadySuggestion', () => {
  it('renders the ready plan with the shared plan concept', () => {
    render(<PlanReadySuggestion task={SESSION} />);

    const suggestion = screen.getByTestId('suggestion-plan-ready');
    expect(suggestion.className).toContain('rounded-md');
    expect(suggestion.querySelector('.lucide-list-checks')).not.toBeNull();
  });
});
