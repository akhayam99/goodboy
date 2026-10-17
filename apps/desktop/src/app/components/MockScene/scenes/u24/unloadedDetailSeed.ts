import { useAppStore } from '../../../../../store';
import { SESSION, SESSION_ID } from '../activityRunSeed';

export const unloadedDetailSeed = () => {
  useAppStore.setState((state) => {
    const projectMounts = state.sessionProjectMounts[SESSION_ID] ?? [];
    const boundMountId = projectMounts[0]?.mountId;
    return {
      mountGithub: Object.fromEntries(
        Object.entries(state.mountGithub).map(([mountId, mount]) => [
          mountId,
          { ...mount, prs: [], pr: null, detail: null },
        ]),
      ),
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [SESSION_ID]: (state.sessionPhaseRuns[SESSION_ID] ?? []).map((agent) =>
          agent.sourceKind === 'failed_check' && boundMountId !== undefined
            ? { ...agent, mountId: boundMountId }
            : agent,
        ),
      },
      sessionMounts: {
        ...state.sessionMounts,
        [SESSION_ID]: projectMounts.map((mount) => ({
          id: mount.mountId,
          sessionId: mount.sessionId,
          projectId: mount.projectId,
          mountName: mount.mountName,
          repoRoot: mount.repoRoot,
          worktreePath: mount.worktreePath,
          lastWorktreePath: mount.lastWorktreePath,
          branch: mount.branch,
          baseBranch: mount.baseBranch,
          parallelIndex: mount.parallelIndex,
          repoSlug: `harborline/${mount.mountName}`,
          isAttached: mount.isAttached,
          diskState: mount.diskState,
          revision: mount.revision,
          createdAt: SESSION.createdAt,
          updatedAt: SESSION.updatedAt,
        })),
      },
    };
  });
};
