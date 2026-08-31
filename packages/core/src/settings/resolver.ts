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

  const resolvedWorkflowId = (() => {
    if (sess?.defaultWorkflowId !== undefined) {
      return sess.defaultWorkflowId;
    }
    if (project?.defaultWorkflowId !== undefined) {
      return project.defaultWorkflowId;
    }
    if (ws?.defaultWorkflowId !== undefined) {
      return ws.defaultWorkflowId;
    }
    return g.defaultWorkflowId;
  })();

  return {
    defaultProviderId:
      sess?.defaultProviderId ??
      project?.defaultProviderId ??
      ws?.defaultProviderId ??
      g.defaultProviderId,
    defaultWorkflowId: resolvedWorkflowId,
    defaultBranchPrefix:
      sess?.defaultBranchPrefix ??
      project?.defaultBranchPrefix ??
      ws?.defaultBranchPrefix ??
      g.defaultBranchPrefix,
    parallelEnabled:
      sess?.parallelEnabled ?? project?.parallelEnabled ?? ws?.parallelEnabled ?? g.parallelEnabled,
    defaultVerbosity:
      sess?.defaultVerbosity ??
      project?.defaultVerbosity ??
      ws?.defaultVerbosity ??
      g.defaultVerbosity,
  };
};
