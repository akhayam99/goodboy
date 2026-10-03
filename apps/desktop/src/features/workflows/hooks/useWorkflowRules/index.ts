import { useCallback, useState } from 'react';
import { DEFAULT_WORKFLOW_RULES, type WorkflowRules, type WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type WorkflowRulesSaveState = 'idle' | 'saving' | 'saved' | 'failed';

export const useWorkflowRules = ({ workspaceId }: Params) => {
  const stored = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.workflowRules ?? null,
  );
  const patchWorkspaceOverrides = useAppStore((state) => state.patchWorkspaceOverrides);
  const [saveState, setSaveState] = useState<WorkflowRulesSaveState>('idle');
  const rules = stored ?? DEFAULT_WORKFLOW_RULES;
  const patch = useCallback(
    async (next: Partial<WorkflowRules>): Promise<void> => {
      const current =
        useAppStore.getState().workspaceOverrides[workspaceId]?.workflowRules ??
        DEFAULT_WORKFLOW_RULES;
      setSaveState('saving');
      try {
        await patchWorkspaceOverrides({
          workspaceId,
          patch: { workflowRules: { ...current, ...next } },
        });
        setSaveState('saved');
      } catch (error) {
        setSaveState('failed');
        throw error;
      }
    },
    [patchWorkspaceOverrides, workspaceId],
  );
  return { rules, isDefault: stored === null, saveState, patch };
};
