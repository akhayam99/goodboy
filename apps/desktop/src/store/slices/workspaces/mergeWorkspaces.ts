import type { SessionContextItem, SessionId, WorkspaceId } from '@goodboy/types';
import {
  listStarredIssues,
  listWorkspaceLearnings,
  mergeWorkspaces as mergeWorkspacesInDb,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { pruneChatImages } from '../../../features/workspace-chat/pruneChatImages';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly sourceWorkspaceIds: ReadonlyArray<WorkspaceId>;
  readonly targetWorkspaceId: WorkspaceId;
};

export const mergeWorkspaces = (set: SetFn, get: GetFn) => {
  return async ({ sourceWorkspaceIds, targetWorkspaceId }: Input): Promise<void> => {
    const state = get();
    const target = state.workspaces.find((workspace) => workspace.id === targetWorkspaceId);
    if (target === undefined) {
      throw new Error(`workspace not found: ${targetWorkspaceId}`);
    }
    const sources = sourceWorkspaceIds.filter((id) => id !== targetWorkspaceId);
    if (sources.length === 0) {
      return;
    }

    await mergeWorkspacesInDb({
      db: tauriDatabase,
      sourceWorkspaceIds: sources,
      targetWorkspaceId,
    });
    await pruneChatImages();
    const [targetLearnings, targetStars] = await Promise.all([
      listWorkspaceLearnings({ db: tauriDatabase, workspaceId: targetWorkspaceId }),
      listStarredIssues({ db: tauriDatabase, workspaceId: targetWorkspaceId }),
    ]);

    const sourceSet = new Set<WorkspaceId>(sources);
    const retarget = (item: SessionContextItem): SessionContextItem =>
      sourceSet.has(item.workspaceId) ? { ...item, workspaceId: targetWorkspaceId } : item;
    set((current) => {
      const archivedSessions = { ...current.archivedSessions };
      const workspaceIntegrations = { ...current.workspaceIntegrations };
      const projectScripts = { ...current.projectScripts };
      const workspaceOverrides = { ...current.workspaceOverrides };
      const workspaceLearnings = { ...current.workspaceLearnings };
      const starredIssues = { ...current.starredIssues };
      for (const id of sources) {
        delete archivedSessions[id];
        delete workspaceIntegrations[id];
        delete projectScripts[id];
        delete workspaceOverrides[id];
        delete workspaceLearnings[id];
        delete starredIssues[id];
      }
      workspaceLearnings[targetWorkspaceId] = targetLearnings;
      starredIssues[targetWorkspaceId] = targetStars;
      const sessionContextItems = Object.fromEntries(
        Object.entries(current.sessionContextItems).map(([sessionId, items]) => [
          sessionId,
          items.map(retarget),
        ]),
      ) as Readonly<Record<SessionId, ReadonlyArray<SessionContextItem>>>;
      return {
        workspaces: current.workspaces.filter((workspace) => !sourceSet.has(workspace.id)),
        projects: current.projects.map((project) =>
          sourceSet.has(project.workspaceId)
            ? { ...project, workspaceId: targetWorkspaceId }
            : project,
        ),
        archivedSessions,
        workspaceIntegrations,
        projectScripts,
        workspaceOverrides,
        workspaceLearnings,
        starredIssues,
        sessionContextItems,
      };
    });

    if (state.currentWorkspaceId === targetWorkspaceId) {
      await get().setCurrentWorkspace(targetWorkspaceId);
    }
  };
};
