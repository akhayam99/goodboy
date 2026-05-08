import type { PhaseTemplateId, SessionId, WorkspaceId } from './ids';
import type { ProviderId } from './provider-registry';

/** Fields that can be overridden at workspace or session scope. Null = inherit from parent. */
export type OverrideSettings = Readonly<{
  defaultProviderId: ProviderId | null;
  defaultPhaseTemplateId: PhaseTemplateId | null;
  defaultBranchPrefix: string | null;
  parallelEnabled: boolean | null;
}>;

/** Fully-resolved settings after applying global → workspace → session cascade. */
export type ResolvedSettings = Readonly<{
  defaultProviderId: ProviderId;
  defaultPhaseTemplateId: PhaseTemplateId | null;
  defaultBranchPrefix: string;
  parallelEnabled: boolean;
}>;

/** Global settings (non-nullable — always has a value). */
export type GlobalSettings = Readonly<{
  defaultProviderId: ProviderId;
  defaultPhaseTemplateId: PhaseTemplateId | null;
  defaultBranchPrefix: string;
  parallelEnabled: boolean;
}>;

export type SettingsScope =
  | { kind: 'global' }
  | { kind: 'workspace'; workspaceId: WorkspaceId }
  | { kind: 'session'; sessionId: SessionId };
