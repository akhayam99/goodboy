// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RunTree } from '../RunTree';
import { useRunTree } from '../RunTree/useRunTree';
import { WorkflowDecisions } from './index';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-31T00:00:00.000Z' as IsoDateTime;

const step = (ordinal: number, name: string, orchestratorReason?: string): Step => ({
  id: `step-${ordinal}` as StepId,
  workflowId: WORKFLOW_ID,
  ordinal,
  name,
  promptPrefix: '',
  ...(orchestratorReason != null && { orchestratorReason }),
});

const baseRun: WorkflowRun = {
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 1,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  createdAt: NOW,
};

const agent = (ordinal: number, name: string, status: Agent['status']): Agent => ({
  id: `agent-${ordinal}` as AgentId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  stepId: `step-${ordinal}` as StepId,
  ordinal,
  name,
  status,
  startedAt: NOW,
});

type HarnessProps = {
  readonly steps: ReadonlyArray<Step>;
  readonly run?: WorkflowRun;
};

const Harness = ({ steps, run = baseRun }: HarnessProps) => {
  const workflow: Workflow = {
    id: WORKFLOW_ID,
    workspaceId: WORKSPACE_ID,
    name: 'Ship',
    description: '',
    steps: [...steps],
    createdAt: NOW,
    updatedAt: NOW,
  };
  const session = {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    workflowRuns: [run],
  } as unknown as Session;
  const tree = useRunTree({ session, run, workflow, agentKindOverride: {} });
  const [highlightedStepId, setHighlightedStepId] = useState<string | null>(null);
  return (
    <>
      <RunTree
        sessionId={SESSION_ID}
        runId={RUN_ID}
        tree={tree}
        routing={{
          stepById: new Map(steps.map((candidate) => [candidate.id, candidate])),
          roleModels: null,
          sessionProvider: null,
          sessionEffort: null,
        }}
        selectedAgentId={null}
        highlightedStepId={highlightedStepId}
        onHighlight={setHighlightedStepId}
        onSelect={() => undefined}
        onAnswer={() => undefined}
      />
      <WorkflowDecisions
        run={run}
        steps={steps}
        tree={tree}
        highlightedStepId={highlightedStepId}
        onHighlight={setHighlightedStepId}
      />
    </>
  );
};

const seed = (agents: ReadonlyArray<Agent>, workflowSteps: ReadonlyArray<Step>) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [...agents] },
    phaseTemplates: {
      [WORKSPACE_ID]: [
        {
          id: WORKFLOW_ID,
          workspaceId: WORKSPACE_ID,
          name: 'Ship',
          description: '',
          steps: [...workflowSteps],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    },
    sessionOpenQuestions: { [SESSION_ID]: [] },
  });
};

const steps = [
  step(0, 'Plan', 'the scout found 14 rules spread over 6 forms'),
  step(1, 'Implement', 'the plan splits validators, schemas and the banner'),
  step(2, 'Test'),
];
const agents = [
  agent(0, 'Plan the validation split', 'completed'),
  agent(1, 'Implement validators', 'running'),
  agent(2, 'Cover guest checkout', 'pending'),
];

const decisionOf = (stepId: string): HTMLElement =>
  screen.getByTestId(`workflow-decision-${stepId}`);

beforeEach(() => {
  useAppStore.setState({
    sessionTelemetry: {},
    agentRunHistory: {},
    sessionWorkflows: {},
    orchestratingWorkflowRuns: {},
    agentTurnState: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
  });
});

afterEach(cleanup);

describe('WorkflowDecisions', () => {
  it('says nothing when no step carries a reason and the run has not ended', () => {
    seed(agents, [step(0, 'Plan'), step(1, 'Implement')]);
    render(<Harness steps={[step(0, 'Plan'), step(1, 'Implement')]} />);

    expect(screen.queryByRole('region', { name: 'Why each step' })).toBeNull();
  });

  it('lists one line per decision, newest first, named like the tree row', () => {
    seed(agents, steps);
    render(<Harness steps={steps} />);

    const section = screen.getByRole('region', { name: 'Why each step' });
    expect(section.textContent).toContain('2 decisions');
    const items = within(section).getAllByRole('listitem');
    expect(items.map((item) => item.dataset.testid)).toEqual([
      'workflow-decision-step-1',
      'workflow-decision-step-0',
    ]);
    expect(items[0]?.textContent).toContain(
      'Implement validators the plan splits validators, schemas and the banner',
    );
  });

  it('opens each line with the same node the tree draws for that step', () => {
    seed(agents, steps);
    render(<Harness steps={steps} />);

    const treeNode = within(screen.getByTestId('run-tree-row-agent-1')).getByRole('img');
    const decisionNode = within(decisionOf('step-1')).getByRole('img');
    expect(decisionNode.getAttribute('aria-label')).toBe(treeNode.getAttribute('aria-label'));
    expect(within(decisionOf('step-0')).getByRole('img', { name: 'Done' })).toBeDefined();
  });

  it('lights the tree row from its decision and the decision from its tree row', () => {
    seed(agents, steps);
    render(<Harness steps={steps} />);

    fireEvent.mouseEnter(decisionOf('step-1'));
    expect(screen.getByTestId('run-tree-row-agent-1').dataset.highlighted).toBe('true');
    fireEvent.mouseLeave(decisionOf('step-1'));
    expect(screen.getByTestId('run-tree-row-agent-1').dataset.highlighted).toBe('false');

    fireEvent.mouseEnter(screen.getByTestId('run-tree-row-agent-0'));
    expect(decisionOf('step-0').dataset.highlighted).toBe('true');
    expect(decisionOf('step-1').dataset.highlighted).toBe('false');
  });

  it('closes with why the run ended, above the step decisions', () => {
    seed(agents, steps);
    const ended: WorkflowRun = {
      ...baseRun,
      orchestrationOutcome: 'blocked',
      orchestrationReason: 'the migration needs a human call',
    };
    render(<Harness steps={steps} run={ended} />);

    const closing = screen.getByTestId('workflow-decision-closing');
    expect(closing.textContent).toContain('Stopped, needs a human call');
    expect(closing.textContent).toContain('the migration needs a human call');
    expect(
      closing.compareDocumentPosition(decisionOf('step-1')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps older decisions behind a count', () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      step(index, `Step ${index}`, `reason ${index}`),
    );
    seed([], many);
    render(<Harness steps={many} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByText(/reason 0/u)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier (2)' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });
});
