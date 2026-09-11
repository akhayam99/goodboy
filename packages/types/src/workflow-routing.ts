import type { ModelEffort, ProviderId } from './provider-registry';

export type WorkflowTaskType =
  | 'exploration'
  | 'planning'
  | 'implementation'
  | 'debugging'
  | 'review'
  | 'testing'
  | 'writing'
  | 'general';

export type WorkflowTaskDifficulty = 'light' | 'standard' | 'heavy' | 'unknown';

export type WorkflowTaskProfile = Readonly<{
  taskType: WorkflowTaskType;
  difficulty: WorkflowTaskDifficulty;
  basis: 'agent' | 'heuristic' | 'unknown';
}>;

export type WorkflowModelPick = Readonly<{
  provider: ProviderId;
  model: string;
  effort: ModelEffort | null;
}>;

export type WorkflowRoutingLock = Readonly<{
  version: 1;
  pick: WorkflowModelPick;
  origin: 'user' | 'legacy';
}>;

export type WorkflowRoutingProposal = Readonly<{
  pick: WorkflowModelPick;
  reason: string;
  source: 'agent' | 'heuristic';
  profile: WorkflowTaskProfile;
}>;

export type WorkflowRoutingDecision = Readonly<{
  version: 1;
  proposal: WorkflowRoutingProposal | null;
  selected: WorkflowModelPick;
  source:
    | 'step_lock'
    | 'run_role_lock'
    | 'agent'
    | 'heuristic'
    | 'role_default'
    | 'session_default'
    | 'kind_default'
    | 'legacy';
  reason: string;
  adjustment:
    'none' | 'unknown_model' | 'disconnected' | 'cooldown' | 'budget' | 'unsupported_effort';
  executed: WorkflowModelPick | null;
}>;
