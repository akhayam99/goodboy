import type { AgentId, ProjectId, SessionId, WorkflowId, WorkflowRunId, WorkspaceId } from '../ids';

type Counters = {
  agent: number;
  project: number;
  session: number;
  workflow: number;
  workflowRun: number;
  workspace: number;
};

const counters: Counters = {
  agent: 0,
  project: 0,
  session: 0,
  workflow: 0,
  workflowRun: 0,
  workspace: 0,
};

export const nextAgentId = (): AgentId => {
  counters.agent += 1;
  return `agent-${counters.agent}` as AgentId;
};

export const nextProjectId = (): ProjectId => {
  counters.project += 1;
  return `project-${counters.project}` as ProjectId;
};

export const nextSessionId = (): SessionId => {
  counters.session += 1;
  return `session-${counters.session}` as SessionId;
};

export const nextWorkflowId = (): WorkflowId => {
  counters.workflow += 1;
  return `workflow-${counters.workflow}` as WorkflowId;
};

export const nextWorkflowRunId = (): WorkflowRunId => {
  counters.workflowRun += 1;
  return `run-${counters.workflowRun}` as WorkflowRunId;
};

export const nextWorkspaceId = (): WorkspaceId => {
  counters.workspace += 1;
  return `workspace-${counters.workspace}` as WorkspaceId;
};
