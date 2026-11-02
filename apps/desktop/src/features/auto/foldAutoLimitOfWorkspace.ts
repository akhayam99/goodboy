import { DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { tauriDatabase } from '../../shared/lib/db';
import { foldAutoLimitIntoRunDefaults } from './foldAutoLimitIntoRunDefaults';

type Params = {
  readonly workspaceId: WorkspaceId;
};

const rulesOf = ({ workspaceId }: Params) =>
  useAppStore.getState().workspaceOverrides[workspaceId]?.workflowRules ?? DEFAULT_WORKFLOW_RULES;

export const foldAutoLimitOfWorkspace = async ({ workspaceId }: Params): Promise<void> => {
  const isFolded = await foldAutoLimitIntoRunDefaults({
    db: tauriDatabase,
    workspaceId,
    runLimitUsd: rulesOf({ workspaceId }).spendLimitUsd,
    saveRunLimit: ({ usd }) =>
      useAppStore.getState().patchWorkspaceOverrides({
        workspaceId,
        patch: { workflowRules: { ...rulesOf({ workspaceId }), spendLimitUsd: usd } },
      }),
  });
  if (isFolded) {
    await useAppStore.getState().loadWorkspaceValue({ workspaceId, key: 'auto.treeLimitUsd' });
  }
};
