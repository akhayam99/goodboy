import type { GlobalSettings, OverrideSettings, ResolvedSettings } from '@kay-am/types';

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

  return {
    defaultProviderId: sess?.defaultProviderId ?? ws?.defaultProviderId ?? g.defaultProviderId,

    defaultWorkflowId:
      sess?.defaultWorkflowId !== undefined
        ? sess.defaultWorkflowId
        : ws?.defaultWorkflowId !== undefined
          ? ws.defaultWorkflowId
          : g.defaultWorkflowId,

    defaultBranchPrefix:
      sess?.defaultBranchPrefix ?? ws?.defaultBranchPrefix ?? g.defaultBranchPrefix,

    parallelEnabled: sess?.parallelEnabled ?? ws?.parallelEnabled ?? g.parallelEnabled,
  };
}
