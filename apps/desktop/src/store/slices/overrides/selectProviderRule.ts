import type { ProviderRule } from '@goodboy/core/providers';
import { DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';

type Params = {
  readonly state: AppStore;
  readonly workspaceId: WorkspaceId;
};

export const selectProviderRule = ({ state, workspaceId }: Params): ProviderRule =>
  (state.workspaceOverrides[workspaceId]?.workflowRules?.spreadByHeadroom ??
  DEFAULT_WORKFLOW_RULES.spreadByHeadroom)
    ? 'load'
    : 'order';
