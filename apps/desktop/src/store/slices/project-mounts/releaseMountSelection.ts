import { updateSessionActiveMount, updateSessionActiveProject } from '@goodboy/db';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { pickActiveMount } from './activeMount';
import type { GetFn, SetFn } from './types';

type ReleaseParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly released: ReadonlyArray<MountId>;
  readonly departedProjectId: ProjectId | null;
};

export const releaseMountSelection = async ({
  set,
  get,
  sessionId,
  released,
  departedProjectId,
}: ReleaseParams): Promise<void> => {
  const remaining = get().sessionProjectMounts[sessionId] ?? [];
  const activeId = get().sessionActiveProject[sessionId] ?? null;
  const dropsProject = departedProjectId !== null && activeId === departedProjectId;
  const nextActiveId = dropsProject ? (remaining[0]?.projectId ?? null) : (activeId ?? null);
  if (dropsProject) {
    await updateSessionActiveProject({
      db: tauriDatabase,
      id: sessionId,
      projectId: nextActiveId,
    }).catch(() => undefined);
  }
  const deleted = new Set<MountId>(released);
  const selectedMountId = get().sessionActiveMount?.[sessionId] ?? null;
  const storedMountId =
    get().sessions.find((candidate) => candidate.id === sessionId)?.activeMountId ?? null;
  const keepsSelected = selectedMountId !== null && !deleted.has(selectedMountId);
  const keepsStored = storedMountId !== null && !deleted.has(storedMountId);
  const holdsActiveMount =
    (selectedMountId === null || keepsSelected) && (storedMountId === null || keepsStored);
  const nextActiveMount = holdsActiveMount
    ? null
    : pickActiveMount({
        mounts: remaining,
        selectedMountId: keepsSelected ? selectedMountId : null,
        storedMountId: keepsStored ? storedMountId : null,
        activeProjectId: nextActiveId,
      });
  const nextActiveMountId = nextActiveMount?.mountId ?? null;
  if (!holdsActiveMount) {
    await updateSessionActiveMount({
      db: tauriDatabase,
      sessionId,
      mountId: nextActiveMountId,
    }).catch(() => undefined);
  }
  set((state) => {
    const worktreeRecords =
      departedProjectId === null ? undefined : state.sessionWorktreeRecords?.[sessionId];
    const sessionBranches = { ...state.sessionBranches };
    if (!holdsActiveMount) {
      if (nextActiveMount === null) {
        delete sessionBranches[sessionId];
      } else {
        sessionBranches[sessionId] = nextActiveMount.branch;
      }
    }
    return {
      ...(worktreeRecords === undefined
        ? {}
        : {
            sessionWorktreeRecords: {
              ...state.sessionWorktreeRecords,
              [sessionId]: worktreeRecords.filter(
                (record) => record.projectId !== departedProjectId,
              ),
            },
          }),
      ...(holdsActiveMount
        ? {}
        : {
            sessionBranches,
            sessionActiveMount: { ...state.sessionActiveMount, [sessionId]: nextActiveMountId },
          }),
      ...(dropsProject
        ? {
            sessionActiveProject: Object.fromEntries(
              Object.entries(state.sessionActiveProject)
                .filter(([key]) => key !== sessionId)
                .concat(nextActiveId === null ? [] : [[sessionId, nextActiveId]]),
            ),
          }
        : {}),
      ...(holdsActiveMount && !dropsProject
        ? {}
        : {
            sessions: state.sessions.map((candidate) => {
              if (candidate.id !== sessionId) {
                return candidate;
              }
              const { activeMountId: _mount, activeProjectId: _project, ...rest } = candidate;
              const keptProjectId = dropsProject
                ? nextActiveId
                : (candidate.activeProjectId ?? null);
              const currentMountId = candidate.activeMountId ?? null;
              const keptMountId = holdsActiveMount ? currentMountId : nextActiveMountId;
              return {
                ...rest,
                ...(keptMountId === null ? {} : { activeMountId: keptMountId }),
                ...(keptProjectId === null ? {} : { activeProjectId: keptProjectId }),
              };
            }),
          }),
    };
  });
};
