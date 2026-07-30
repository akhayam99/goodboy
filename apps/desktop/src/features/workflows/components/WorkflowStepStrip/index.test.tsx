// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { WorkflowStepStrip } from './index';

const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const SESSION_ID = 'session-1' as SessionId;
const NOW = '2026-07-30T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'Ship',
  description: '',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: '',
      modelOverride: 'claude-sonnet-4-5',
    },
    {
      id: 'step-2' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Implement',
      promptPrefix: '',
      modelOverride: 'gpt-5.1-codex',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const runs: ReadonlyArray<Agent> = [
  {
    id: 'agent-1' as AgentId,
    sessionId: SESSION_ID,
    stepId: 'step-1' as StepId,
    ordinal: 0,
    name: 'Scout',
    status: 'completed',
  },
  {
    id: 'agent-2' as AgentId,
    sessionId: SESSION_ID,
    stepId: 'step-2' as StepId,
    ordinal: 1,
    name: 'Implement',
    status: 'running',
  },
];

afterEach(cleanup);

describe('WorkflowStepStrip', () => {
  it('shows operational step details and selects a step agent', () => {
    const onSelect = vi.fn();
    const child = {
      ...runs[0]!,
      id: 'child-1' as AgentId,
      parentAgentId: runs[0]!.id,
    };

    render(
      <WorkflowStepStrip
        workflow={workflow}
        runs={runs}
        childrenByParentId={new Map([[runs[0]!.id, [child]]])}
        agentKindOverride={{}}
        agentModelOverride={{}}
        roleModels={null}
        selectedAgentId={runs[1]!.id}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('1/1')).toBeDefined();
    expect(screen.getByLabelText('running')).toBeDefined();
    expect(screen.getByText('Sonnet 4.5')).toBeDefined();
    expect(screen.getByText('gpt-5.1-codex')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /scout/i }));
    expect(onSelect).toHaveBeenCalledWith(runs[0]!.id);
  });
});
