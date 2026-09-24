import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { GetFn } from './types';

export type WorkspaceOverridesPatch = {
  readonly [Key in keyof OverrideSettings]?: OverrideSettings[Key];
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly patch: WorkspaceOverridesPatch;
};

const EMPTY_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
};

export const mergeWorkspaceOverrides = ({
  base,
  patch,
}: {
  readonly base: OverrideSettings;
  readonly patch: WorkspaceOverridesPatch;
}): OverrideSettings => {
  const pick = <Key extends keyof OverrideSettings>(key: Key): OverrideSettings[Key] =>
    key in patch ? (patch[key] ?? EMPTY_OVERRIDES[key]) : base[key];
  return {
    defaultProviderId: pick('defaultProviderId'),
    defaultWorkflowId: pick('defaultWorkflowId'),
    defaultBranchPrefix: pick('defaultBranchPrefix'),
    parallelEnabled: pick('parallelEnabled'),
    defaultVerbosity: pick('defaultVerbosity'),
    providerBindings: pick('providerBindings'),
    taskModels: pick('taskModels'),
    roleModels: pick('roleModels'),
    parallelAgents: pick('parallelAgents'),
    providerPool: pick('providerPool'),
    attributionFooter: pick('attributionFooter'),
  };
};

export const patchWorkspaceOverrides = (get: GetFn) => {
  return async ({ workspaceId, patch }: Params): Promise<void> => {
    const base = get().workspaceOverrides[workspaceId] ?? EMPTY_OVERRIDES;
    await get().setWorkspaceOverrides(workspaceId, mergeWorkspaceOverrides({ base, patch }));
  };
};
