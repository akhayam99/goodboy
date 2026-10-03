import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { editPostedReplyKey } from '../../resolve/editPostedReplySetting';
import { copyPlan, type PagePlan, type PlanScope } from './plan';
import { workspaceSettingsSnapshot } from './snapshot';

export type FlowSource = {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly projectCount: number;
  readonly plan: ReadonlyArray<PagePlan>;
};

export const loadFlowSources = async ({
  workspaceId,
  scope,
}: {
  readonly workspaceId: WorkspaceId;
  readonly scope: PlanScope;
}): Promise<ReadonlyArray<FlowSource>> => {
  const store = useAppStore.getState();
  const others = store.workspaces.filter(
    (workspace) => workspace.id !== workspaceId && workspace.deletedAt === undefined,
  );
  await Promise.all(
    others.map((workspace) =>
      Promise.all([
        store.loadWorkspaceOverrides(workspace.id),
        store.loadSetting(editPostedReplyKey({ workspaceId: workspace.id })),
      ]),
    ),
  );
  const state = useAppStore.getState();
  const current = workspaceSettingsSnapshot({ state, workspaceId });
  return others.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    projectCount: state.projects.filter((project) => project.workspaceId === workspace.id).length,
    plan: copyPlan({
      scope,
      current,
      source: workspaceSettingsSnapshot({ state, workspaceId: workspace.id }),
    }),
  }));
};
