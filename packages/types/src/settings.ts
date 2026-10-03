import type { ProjectId, SessionId, WorkflowId, WorkspaceId } from './ids';
import type { ProviderPolicy } from './provider-policy';
import type { EffortLevel, ProviderId } from './provider-registry';
import type { AgentRole } from './workflow';
import type { WorkflowRules } from './workflow-rules';

export type VerbosityLevel = 'brief' | 'normal' | 'verbose';

export type ProviderBindings = Partial<Record<ProviderId, string>>;

export type AuxTaskId =
  | 'summarizer'
  | 'plan_generation'
  | 'prose_polish'
  | 'agent_naming'
  | 'issue_brief'
  | 'workflow_orchestrator'
  | 'question_delegate'
  | 'pr_draft'
  | 'rebase'
  | 'recheck';

export type TaskModelFallback = Readonly<{
  providerId: ProviderId;
  model: string;
  effort?: EffortLevel;
}>;

export type TaskModelPreference = Readonly<{
  providerId: ProviderId;
  model: string;
  effort?: EffortLevel;
  fallback?: TaskModelFallback;
}>;

export type TaskModelPreferences = Readonly<Partial<Record<AuxTaskId, TaskModelPreference>>>;

export type RoleModelFallback = Readonly<{
  providerId: ProviderId;
  model: string;
  effort?: EffortLevel;
}>;

export type RoleModelChoice = Readonly<{
  providerId: ProviderId;
  model: string;
  effort?: EffortLevel;
}>;

export const ROLE_MODEL_SET_MAX = 3;

export type RoleModelPreference = Readonly<{
  providerId: ProviderId;
  model: string;
  effort: EffortLevel;
  fallback?: RoleModelFallback;
  models?: ReadonlyArray<RoleModelChoice>;
}>;

export type RoleModelPreferences = Readonly<Partial<Record<AgentRole, RoleModelPreference>>>;

export type OverrideSettings = Readonly<{
  defaultProviderId: ProviderId | null;
  defaultBranchPrefix: string | null;
  defaultBranchTemplate: string | null;
  defaultVerbosity: VerbosityLevel | null;
  providerBindings: ProviderBindings | null;
  taskModels: TaskModelPreferences | null;
  roleModels: RoleModelPreferences | null;
  parallelAgents: boolean | null;
  providerPool: ProviderPolicy | null;
  attributionFooter: boolean | null;
  replyVoice: ReplyVoice | null;
  replyStyleNote: string | null;
  replyTemplateFixed: string | null;
  replyTemplateNoChange: string | null;
  resolveOnGithub: boolean | null;
  resolveCommitStyle: ResolveCommitStyle | null;
  afterMerge: AfterMergeRule | null;
  workflowRules?: WorkflowRules | null;
}>;

export const REPLY_VOICES = ['terse', 'friendly', 'formal', 'mine'] as const;

export type ReplyVoice = (typeof REPLY_VOICES)[number];

export const RESOLVE_COMMIT_STYLES = ['new', 'fixup'] as const;

export type ResolveCommitStyle = (typeof RESOLVE_COMMIT_STYLES)[number];

export const AFTER_MERGE_RULES = ['ask', 'local', 'local-and-origin'] as const;

export type AfterMergeRule = (typeof AFTER_MERGE_RULES)[number];

export type ResolvedSettings = Readonly<{
  defaultProviderId: ProviderId;
  defaultWorkflowId: WorkflowId | null;
  defaultBranchPrefix: string;
  parallelEnabled: boolean;
  defaultVerbosity: VerbosityLevel;
  roleModels: RoleModelPreferences | null;
  taskModels: TaskModelPreferences | null;
  providerPool: ProviderPolicy | null;
  parallelAgents: boolean;
  providerBindings: ProviderBindings;
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
  | { kind: 'project'; projectId: ProjectId }
  | { kind: 'session'; sessionId: SessionId };
