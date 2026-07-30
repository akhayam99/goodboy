// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (state: typeof h.state) => T) => selector(h.state),
}));

vi.mock('../../../session/hooks/useAgentMetrics', () => ({
  useAgentMetrics: () => ({
    latestTelemetryByAgentId: new Map([
      [
        'agent-1',
        {
          kind: 'turn',
          runId: 'provider-run-1' as ProviderRunId,
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          inputTokens: 800,
          outputTokens: 200,
          estimatedCostUsd: 0.5,
          recordedAt: '2026-07-30T12:00:00.000Z',
        },
      ],
    ]),
    aggregatesByAgentId: new Map([
      ['agent-1', { inputTokens: 1_200, outputTokens: 300, estimatedCostUsd: 1.5, turns: 2 }],
    ]),
    providerUsageByAgentId: new Map([
      [
        'agent-1',
        [
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            inputTokens: 1_200,
            outputTokens: 300,
          },
        ],
      ],
    ]),
    turnsByAgentId: new Map([['agent-1', 2]]),
  }),
}));

import { WorkflowStepInspector } from './index';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'workflow-run-1' as WorkflowRunId;
const AGENT_ID = 'agent-1' as AgentId;
const NOW = '2026-07-30T12:00:00.000Z' as IsoDateTime;
const COMPLETED_AT = '2026-07-30T12:05:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Ship',
  description: '',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: 'Map the code.',
    },
    {
      id: 'step-2' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Implement',
      promptPrefix: 'Implement the plan.',
      expectedOutput: 'A tested change.',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  stepId: 'step-2' as StepId,
  ordinal: 1,
  name: 'Implement',
  status: 'completed',
  outputSummary: '**Done** with tests.',
  startedAt: NOW,
  completedAt: COMPLETED_AT,
};

const session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  workflowRuns: [
    {
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 1,
      autoRun: false,
      triggerMode: 'immediate',
    },
  ],
} as unknown as Session;

beforeEach(() => {
  Object.assign(h.state, {
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionWorkflows: {},
    agentKindOverride: { [AGENT_ID]: 'implementer' },
    agentModelOverride: {},
    agentProviderOverride: {},
  });
});

afterEach(cleanup);

describe('WorkflowStepInspector', () => {
  it('shows step guidance, origin, output, routing, metrics, and timestamps', () => {
    const expectedStartedAt = formatAbsoluteDateTime({ iso: NOW });
    const expectedCompletedAt = formatAbsoluteDateTime({ iso: COMPLETED_AT });

    render(<WorkflowStepInspector session={session} agentId={AGENT_ID} />);

    expect(screen.getByText('Implement the plan.')).toBeDefined();
    expect(screen.getByText('A tested change.')).toBeDefined();
    expect(screen.getByText('Step 2: Implement')).toBeDefined();
    expect(screen.getByText('Scout')).toBeDefined();
    expect(screen.getByText(/Done/)).toBeDefined();
    expect(screen.getByText('Sonnet 4.5')).toBeDefined();
    expect(screen.getByText('$1.50')).toBeDefined();
    expect(screen.getByText('1.2k')).toBeDefined();
    expect(screen.getByText('300')).toBeDefined();
    expect(screen.getByText(expectedStartedAt)).toBeDefined();
    expect(screen.getByText(expectedCompletedAt)).toBeDefined();
  });
});
