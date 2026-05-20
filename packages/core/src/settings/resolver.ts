import type { GlobalSettings, OverrideSettings, ResolvedSettings } from '@goodboy/types';

export type ResolveSettingsInput = {
  readonly global: GlobalSettings;
  readonly workspaceOverride?: OverrideSettings | null;
  readonly sessionOverride?: OverrideSettings | null;
};

/**
 * Pure fn — browser-safe, no I/O.
 * Resolution order: session > workspace > global (null = inherit).
 */
export function resolveSettings(input: ResolveSettingsInput): ResolvedSettings {
  const { global: g, workspaceOverride: ws, sessionOverride: sess } = input;

  // workflowId can be `null` (explicit "no workflow" override), so `??` cannot
  // chain — first defined wins, including null.
  const resolvedWorkflowId = (() => {
    if (sess?.defaultWorkflowId !== undefined) return sess.defaultWorkflowId;
    if (ws?.defaultWorkflowId !== undefined) return ws.defaultWorkflowId;
    return g.defaultWorkflowId;
  })();

  return {
    defaultProviderId: sess?.defaultProviderId ?? ws?.defaultProviderId ?? g.defaultProviderId,
    defaultWorkflowId: resolvedWorkflowId,
    defaultBranchPrefix:
      sess?.defaultBranchPrefix ?? ws?.defaultBranchPrefix ?? g.defaultBranchPrefix,
    parallelEnabled: sess?.parallelEnabled ?? ws?.parallelEnabled ?? g.parallelEnabled,
  };
}
