import type { GlobalSettings, OverrideSettings, ResolvedSettings } from '@goodboy/types';

export type ResolveSettingsInput = {
  readonly global: GlobalSettings;
  readonly workspaceOverride?: OverrideSettings | null;
  readonly projectOverride?: OverrideSettings | null;
  readonly sessionOverride?: OverrideSettings | null;
};

type Keyed<V> = Readonly<Record<string, V | undefined>>;

type MergeKeyedParams<V> = {
  readonly layers: ReadonlyArray<Keyed<V> | null | undefined>;
};

const mergeKeyed = <V extends object>({
  layers,
}: MergeKeyedParams<V>): Readonly<Record<string, V>> | null => {
  const entries = layers.flatMap((layer) => Object.entries(layer ?? {}));
  const merged: Record<string, V> = Object.fromEntries(
    entries.flatMap(([key, value]) => (value === undefined ? [] : [[key, value] as const])),
  );
  return Object.keys(merged).length > 0 ? merged : null;
};

export const resolveSettings = (input: ResolveSettingsInput): ResolvedSettings => {
  const {
    global: g,
    workspaceOverride: ws,
    projectOverride: project,
    sessionOverride: sess,
  } = input;

  return {
    roleModels: mergeKeyed({
      layers: [ws?.roleModels, project?.roleModels, sess?.roleModels],
    }),
    taskModels: mergeKeyed({
      layers: [ws?.taskModels, project?.taskModels, sess?.taskModels],
    }),
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
