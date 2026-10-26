import { useCallback } from 'react';
import { DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type OrchestratorModelPickModel = Readonly<{
  isOn: boolean;
  setIsOn: (next: boolean) => void;
}>;

export const useOrchestratorModelPick = ({ workspaceId }: Params): OrchestratorModelPickModel => {
  const isOn = useAppStore(
    (state) =>
      state.workspaceOverrides[workspaceId]?.workflowRules?.canOrchestratorPickModel === true,
  );
  const patchWorkspaceOverrides = useAppStore((state) => state.patchWorkspaceOverrides);
  const reportError = useAppStore((state) => state.reportError);

  const setIsOn = useCallback(
    (isNext: boolean) => {
      const current =
        useAppStore.getState().workspaceOverrides[workspaceId]?.workflowRules ??
        DEFAULT_WORKFLOW_RULES;
      patchWorkspaceOverrides({
        workspaceId,
        patch: { workflowRules: { ...current, canOrchestratorPickModel: isNext } },
      }).catch((error: unknown) => {
        void reportError({
          title: "Couldn't save the run defaults",
          error,
          workspaceId,
          recovery: NOTHING_CHANGED,
        });
      });
    },
    [patchWorkspaceOverrides, reportError, workspaceId],
  );

  return { isOn, setIsOn };
};
