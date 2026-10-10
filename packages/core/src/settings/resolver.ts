import type {
  GlobalSettings,
  OverrideSettings,
  ResolvedSettings,
  RoleModelPreference,
  TaskModelPreference,
} from '@goodboy/types';
import { createKeyedMerge } from './createKeyedMerge';

export type ResolveSettingsInput = {
  readonly global: GlobalSettings;
  readonly workspaceOverride?: OverrideSettings | null;
  readonly projectOverride?: OverrideSettings | null;
  readonly sessionOverride?: OverrideSettings | null;
};

const mergeRoleModels = createKeyedMerge<RoleModelPreference>();

const mergeTaskModels = createKeyedMerge<TaskModelPreference>();

export const resolveSettings = (input: ResolveSettingsInput): ResolvedSettings => {
  const {
    global: g,
    workspaceOverride: ws,
    projectOverride: project,
    sessionOverride: sess,
  } = input;

  return {
    roleModels: mergeRoleModels({
      layers: [ws?.roleModels, project?.roleModels, sess?.roleModels],
    }),
    taskModels: mergeTaskModels({
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
