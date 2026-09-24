import type { ProjectId, SessionId, WorkflowId, WorkspaceId } from './ids';
import type { EffortLevel, ProviderId } from './provider-registry';
import type { AgentRole } from './workflow';

export type VerbosityLevel = 'brief' | 'normal' | 'verbose';

export type ProviderBindings = Partial<Record<ProviderId, string>>;

export type AuxTaskId =
  | 'summarizer'
  | 'plan_generation'
  | 'prose_polish'
  | 'agent_naming'
  | 'workflow_orchestrator'
  | 'question_delegate'
  | 'pr_draft'
  | 'rebase';

export type TaskModelPreference = Readonly<{
  providerId: ProviderId;
  model: string;
  effort?: EffortLevel;
}>;

export type TaskModelPreferences = Readonly<Partial<Record<AuxTaskId, TaskModelPreference>>>;

export type RoleModelFallback = Readonly<{
  providerId: ProviderId;
  model: string;
  effort?: EffortLevel;
}>;

export type RoleModelPreference = Readonly<{
  providerId: ProviderId;
  model: string;
  effort: EffortLevel;
  fallback?: RoleModelFallback;
}>;

export type RoleModelPreferences = Readonly<Partial<Record<AgentRole, RoleModelPreference>>>;

export type OverrideSettings = Readonly<{
  defaultProviderId: ProviderId | null;
  defaultWorkflowId: WorkflowId | null;
  defaultBranchPrefix: string | null;
  parallelEnabled: boolean | null;
  defaultVerbosity: VerbosityLevel | null;
  providerBindings: ProviderBindings | null;
  taskModels: TaskModelPreferences | null;
  roleModels: RoleModelPreferences | null;
  parallelAgents: boolean | null;
  providerPool: ReadonlyArray<ProviderId> | null;
  attributionFooter: boolean | null;
  invocationGlobalLimit?: number | null;
  invocationProviderLimit?: number | null;
  invocationHeavyweightLimit?: number | null;
}>;

export type ResolvedSettings = Readonly<{
  defaultProviderId: ProviderId;
  defaultWorkflowId: WorkflowId | null;
  defaultBranchPrefix: string;
  parallelEnabled: boolean;
  defaultVerbosity: VerbosityLevel;
  roleModels: RoleModelPreferences | null;
  taskModels: TaskModelPreferences | null;
  providerPool: ReadonlyArray<ProviderId> | null;
  parallelAgents: boolean;
  providerBindings: ProviderBindings;
  invocationGlobalLimit: number;
  invocationProviderLimit: number;
  invocationHeavyweightLimit: number;
}>;

export type GlobalSettings = Readonly<{
  defaultProviderId: ProviderId;
  defaultWorkflowId: WorkflowId | null;
  defaultBranchPrefix: string;
  parallelEnabled: boolean;
  defaultVerbosity: VerbosityLevel;
  invocationGlobalLimit?: number;
  invocationProviderLimit?: number;
  invocationHeavyweightLimit?: number;
}>;

export type SettingsScope =
  | { kind: 'global' }
  | { kind: 'workspace'; workspaceId: WorkspaceId }
  | { kind: 'project'; projectId: ProjectId }
  | { kind: 'session'; sessionId: SessionId };
