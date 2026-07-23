import type { SessionId, WorkflowId, WorkspaceId } from './ids';
import type { ProviderId } from './provider-registry';

export type VerbosityLevel = 'brief' | 'normal' | 'verbose';

export type ProviderBindings = Partial<Record<ProviderId, string>>;

export type AuxTaskId =
  | 'summarizer'
  | 'branch_naming'
  | 'plan_generation'
  | 'agent_naming'
  | 'pr_draft';

export type TaskModelPreference = Readonly<{
  providerId: ProviderId;
  model: string;
}>;

export type TaskModelPreferences = Readonly<Partial<Record<AuxTaskId, TaskModelPreference>>>;

export type OverrideSettings = Readonly<{
  defaultProviderId: ProviderId | null;
  defaultWorkflowId: WorkflowId | null;
  defaultBranchPrefix: string | null;
  parallelEnabled: boolean | null;
  defaultVerbosity: VerbosityLevel | null;
  providerBindings: ProviderBindings | null;
  taskModels: TaskModelPreferences | null;
  scoutFanout: boolean | null;
}>;

export type ResolvedSettings = Readonly<{
  defaultProviderId: ProviderId;
  defaultWorkflowId: WorkflowId | null;
  defaultBranchPrefix: string;
  parallelEnabled: boolean;
  defaultVerbosity: VerbosityLevel;
}>;

export type GlobalSettings = Readonly<{
  defaultProviderId: ProviderId;
  defaultWorkflowId: WorkflowId | null;
  defaultBranchPrefix: string;
  parallelEnabled: boolean;
  defaultVerbosity: VerbosityLevel;
}>;

export type SettingsScope =
  | { kind: 'global' }
  | { kind: 'workspace'; workspaceId: WorkspaceId }
  | { kind: 'session'; sessionId: SessionId };
