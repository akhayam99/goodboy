import { DEFAULT_BRANCH_TEMPLATE } from '@goodboy/core';
import type { Project, WorkspaceId } from '@goodboy/types';
import { DEFAULT_BRANCH_PREFIX } from '../../../features/settings/settings';
import type { AppStore } from '../../store';

type BranchNamingState = Pick<
  AppStore,
  'workspaceOverrides' | 'githubStatus' | 'githubWorkspaceStatus'
>;

export type BranchNamingSettings = {
  readonly template: string;
  readonly prefix: string;
  readonly user: string | null;
};

type Params = {
  readonly state: BranchNamingState;
  readonly workspaceId: WorkspaceId;
  readonly project: Project | null;
};

const filled = (value: string | null | undefined): string | null =>
  value == null || value.trim() === '' ? null : value.trim();

export const branchNamingSettings = ({
  state,
  workspaceId,
  project,
}: Params): BranchNamingSettings => {
  const workspace = state.workspaceOverrides[workspaceId] ?? null;
  return {
    template:
      filled(project?.overrides.defaultBranchTemplate) ??
      filled(workspace?.defaultBranchTemplate) ??
      DEFAULT_BRANCH_TEMPLATE,
    prefix:
      filled(project?.overrides.defaultBranchPrefix) ??
      filled(workspace?.defaultBranchPrefix) ??
      DEFAULT_BRANCH_PREFIX,
    user:
      filled(state.githubWorkspaceStatus?.[workspaceId]?.user) ?? filled(state.githubStatus?.user),
  };
};
