import type { GlobalSettings, OverrideSettings, ResolvedSettings } from '@goodboy/types';

export type ResolveSettingsInput = {
  readonly global: GlobalSettings;
  readonly workspaceOverride?: OverrideSettings | null;
  readonly projectOverride?: OverrideSettings | null;
  readonly sessionOverride?: OverrideSettings | null;
};

export const resolveSettings = (input: ResolveSettingsInput): ResolvedSettings => {
  const {
    global: g,
    workspaceOverride: ws,
    projectOverride: project,
    sessionOverride: sess,
  } = input;

  return {
    roleModels: sess?.roleModels ?? project?.roleModels ?? ws?.roleModels ?? null,
    taskModels: sess?.taskModels ?? project?.taskModels ?? ws?.taskModels ?? null,
    providerPool: sess?.providerPool ?? project?.providerPool ?? ws?.providerPool ?? null,
    parallelAgents: sess?.parallelAgents ?? project?.parallelAgents ?? ws?.parallelAgents ?? false,
    providerBindings: {
      ...ws?.providerBindings,
      ...project?.providerBindings,
      ...sess?.providerBindings,
    },
    defaultProviderId:
      sess?.defaultProviderId ??
      project?.defaultProviderId ??
      ws?.defaultProviderId ??
      g.defaultProviderId,
    defaultWorkflowId: g.defaultWorkflowId,
    defaultBranchPrefix:
      sess?.defaultBranchPrefix ??
      project?.defaultBranchPrefix ??
      ws?.defaultBranchPrefix ??
      g.defaultBranchPrefix,
    parallelEnabled: g.parallelEnabled,
    defaultVerbosity:
      sess?.defaultVerbosity ??
      project?.defaultVerbosity ??
      ws?.defaultVerbosity ??
      g.defaultVerbosity,
  };
};
