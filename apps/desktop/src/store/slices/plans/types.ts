import type { AgentId, WorkflowRunId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export type RunPlanResult =
  | Readonly<{ kind: 'started'; agentId: AgentId; scope: 'workflow' | 'session' }>
  | Readonly<{ kind: 'startedOutside'; agentId: AgentId; note: string }>
  | Readonly<{ kind: 'refused'; reason: string | null; workflowRunId: WorkflowRunId | null }>;
