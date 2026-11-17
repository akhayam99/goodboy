import type { AutoLevel } from '@goodboy/core/auto';
import { DEFAULT_WORKFLOW_RULES, type WorkflowAutonomy, type WorkspaceId } from '@goodboy/types';
import { CHECK_STATE } from '../notifications/errorRecovery';
import { announceWorkspaceChange } from './announceWorkspaceChange';
import type { GetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly level: AutoLevel;
};

type Deps = {
  readonly get: GetFn;
};

type ReadParams = {
  readonly get: GetFn;
  readonly workspaceId: WorkspaceId;
};

type AutonomyParams = ReadParams & {
  readonly autonomy: WorkflowAutonomy;
};

const autonomyOf = ({ get, workspaceId }: ReadParams): WorkflowAutonomy =>
  get().workspaceOverrides[workspaceId]?.workflowRules?.autonomy ?? DEFAULT_WORKFLOW_RULES.autonomy;

const writeAutonomy = ({ get, workspaceId, autonomy }: AutonomyParams): Promise<void> => {
  const rules = get().workspaceOverrides[workspaceId]?.workflowRules ?? DEFAULT_WORKFLOW_RULES;
  return get().patchWorkspaceOverrides({
    workspaceId,
    patch: { workflowRules: { ...rules, autonomy } },
  });
};

export const changeStopsLevel = ({ get }: Deps) => {
  return async ({ workspaceId, level }: Params): Promise<void> => {
    const before = autonomyOf({ get, workspaceId });
    await writeAutonomy({ get, workspaceId, autonomy: level });
    try {
      await get().changeAutoLevel({ workspaceId, sessionId: null, level });
    } catch (failure) {
      if (autonomyOf({ get, workspaceId }) === level) {
        await writeAutonomy({ get, workspaceId, autonomy: before }).catch((undoFailure: unknown) =>
          get().reportError({
            recovery: CHECK_STATE,
            title: "Couldn't put the workflow level back",
            error: undoFailure,
            workspaceId,
          }),
        );
      }
      throw failure;
    } finally {
      announceWorkspaceChange({ get, workspaceId, key: 'overrides' });
    }
  };
};
