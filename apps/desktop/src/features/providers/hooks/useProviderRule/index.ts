import { useCallback } from 'react';
import type { ProviderRule } from '@goodboy/core/providers';
import { DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectProviderRule } from '../../../../store/slices/overrides/selectProviderRule';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type ProviderRuleModel = Readonly<{
  rule: ProviderRule;
  setRule: (rule: ProviderRule) => void;
}>;

export const useProviderRule = ({ workspaceId }: Params): ProviderRuleModel => {
  const rule = useAppStore((state) => selectProviderRule({ state, workspaceId }));
  const patchWorkspaceOverrides = useAppStore((state) => state.patchWorkspaceOverrides);
  const reportError = useAppStore((state) => state.reportError);

  const setRule = useCallback(
    (rule: ProviderRule) => {
      const current =
        useAppStore.getState().workspaceOverrides[workspaceId]?.workflowRules ??
        DEFAULT_WORKFLOW_RULES;
      patchWorkspaceOverrides({
        workspaceId,
        patch: { workflowRules: { ...current, spreadByHeadroom: rule === 'load' } },
      }).catch((error: unknown) => {
        void reportError({
          title: "Couldn't save the provider priority",
          error,
          workspaceId,
          recovery: NOTHING_CHANGED,
        });
      });
    },
    [patchWorkspaceOverrides, reportError, workspaceId],
  );

  return { rule, setRule };
};
