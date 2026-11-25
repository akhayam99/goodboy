import {
  DEFAULT_WORKFLOW_RULES,
  type WorkflowSpendLimitMode,
  type WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../../store/slices/overrides/selectResolvedSettings';
import { VERBOSITY_LABEL } from '../../../../settings/verbosity';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type EveryRunFacts = Readonly<{
  limitMode: WorkflowSpendLimitMode;
  replies: string;
}>;

export const useEveryRunFacts = ({ workspaceId }: Params): EveryRunFacts => {
  const limitMode = useAppStore(
    (state) =>
      state.workspaceOverrides[workspaceId]?.workflowRules?.spendLimitMode ??
      DEFAULT_WORKFLOW_RULES.spendLimitMode,
  );
  const replies = useAppStore(
    (state) =>
      VERBOSITY_LABEL[selectWorkspaceResolvedSettings({ state, workspaceId }).defaultVerbosity],
  );
  return { limitMode, replies };
};
