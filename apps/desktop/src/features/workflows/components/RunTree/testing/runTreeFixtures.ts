import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { AgentKind } from '../../../../session/agent-kind';
import { buildTimelineGroups } from '../../../../session/timeline/buildTimelineGroups';
import { buildRunTreeStream } from '../../../../session/timeline/buildTimelineStream';

export const SESSION_ID = 'session-1' as SessionId;
export const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
export const WORKFLOW_ID = 'workflow-1' as WorkflowId;
export const RUN_ID = 'run-1' as WorkflowRunId;
export const PARENT_ROW = 'agent:implement';
export const PARENT_SET = `subagents:${PARENT_ROW}`;

export const at = (minute: number) => new Date(2026, 7, 18, 9, minute).toISOString() as IsoDateTime;

export const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Refund keys',
  description: '',
  steps: ['scout', 'implement', 'review'].map((name, ordinal) => ({
    id: `step-${name}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name,
    promptPrefix: '',
  })),
  createdAt: at(0),
  updatedAt: at(0),
};

export const run: WorkflowRun = {
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 1,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'static',
  createdAt: at(0),
};

export const session = aSession({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  workflowRuns: [run],
});

type StepParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly status: Agent['status'];
};

export const step = ({ id, ordinal, status }: StepParams): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  stepId: `step-${id}` as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: id,
  status,
  ...(status === 'pending' ? {} : { startedAt: at(ordinal) }),
  ...(status === 'completed' ? { completedAt: at(ordinal + 1) } : {}),
});

type ChildParams = {
  readonly id: string;
  readonly minute: number;
  readonly parent?: string;
  readonly status?: Agent['status'];
};

export const child = ({
  id,
  minute,
  parent = 'implement',
  status = 'completed',
}: ChildParams): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  parentAgentId: parent as AgentId,
  ordinal: 100 + minute,
  name: id,
  status,
  startedAt: at(minute),
  ...(status === 'completed' ? { completedAt: at(minute + 1) } : {}),
});

export const scouts = (status: Agent['status'] = 'completed'): ReadonlyArray<Agent> => [
  child({ id: 'scout-a', minute: 11, status }),
  child({ id: 'scout-b', minute: 12 }),
  child({ id: 'scout-c', minute: 13 }),
];

export const baseAgents: ReadonlyArray<Agent> = [
  step({ id: 'scout', ordinal: 1, status: 'completed' }),
  step({ id: 'implement', ordinal: 2, status: 'running' }),
  step({ id: 'review', ordinal: 3, status: 'pending' }),
];

export const question = ({ agentId }: { readonly agentId: string }): OpenQuestion => ({
  id: 'oq-1' as OpenQuestionId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  createdByAgentId: agentId as AgentId,
  text: 'Keep the legacy export?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: at(14),
});

type StreamParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly kinds?: Readonly<Record<string, AgentKind>>;
};

export const streamOf = ({ agents, questions = [], kinds = {} }: StreamParams) => {
  const { entries } = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents,
    workflows: [{ run, workflow }],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions,
    worktrees: [],
    events: [],
    agentKindOverride: kinds,
  });
  const entry = entries.find((candidate) => candidate.kind === 'run');
  if (entry?.kind !== 'run') {
    throw new Error('run entry is missing');
  }
  return buildRunTreeStream({
    entry,
    unreadAgentIds: new Set(),
    advance: null,
    isDeciding: false,
  });
};
