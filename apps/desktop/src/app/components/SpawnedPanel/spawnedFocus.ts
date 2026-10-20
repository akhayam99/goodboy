import type { AgentId, WorkflowRunId } from '@goodboy/types';

export type SpawnedFocus =
  | { readonly kind: 'run'; readonly runId: WorkflowRunId }
  | { readonly kind: 'auto'; readonly rootAgentId: AgentId };
