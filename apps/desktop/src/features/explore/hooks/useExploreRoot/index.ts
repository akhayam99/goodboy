import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CrumbMenuGroup } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectFirstLapProject } from '../../../../store/slices/bootstrap/firstLap';
import { findMountById } from '../../../../store/slices/project-mounts/findMountById';
import { recoverSoleMount } from '../../../../store/slices/project-mounts/recoverSoleMount';
import { selectAutomaticTurnMount } from '../../../../store/slices/project-mounts/selectAutomaticTurnMount';
import { selectSelectedMountId } from '../../../../store/slices/project-mounts/selectedMountId';
import { selectWritableMounts } from '../../../../store/slices/project-mounts/selectors';
import { branchMenuGroups } from '../../../session/trail/menus/branchMenu';
import { scratchDirPrepare } from '../../../worktree/worktree';
import { selectExploreMount, type ExploreTarget } from '../../selectExploreMount';

type Params = {
  readonly sessionId: SessionId;
};

type PickParams = {
  readonly mountPath: string | null;
};

type Scratch = {
  readonly sessionId: SessionId;
  readonly path: string | null;
};

export type ExploreRootView = {
  readonly target: ExploreTarget;
  readonly isResolving: boolean;
  readonly groups: ReadonlyArray<CrumbMenuGroup>;
  readonly rowCount: number;
  readonly pick: (params: PickParams) => void;
};

export const useExploreRoot = ({ sessionId }: Params): ExploreRootView => {
  const requestedPath = useAppStore((state) => state.exploreMountPath[sessionId] ?? null);
  const views = useAppStore((state) => state.sessionMounts?.[sessionId]);
  const projectMounts = useAppStore((state) => state.sessionProjectMounts?.[sessionId]);
  const activeMountId = useAppStore((state) => selectSelectedMountId({ state, sessionId }));
  const projects = useAppStore((state) => state.projects);
  const firstLapProject = useAppStore((state) => selectFirstLapProject({ state, sessionId }));
  const setExploreMountPath = useAppStore((state) => state.setExploreMountPath);

  const mountState = useMemo(
    () => ({
      sessionMounts: views === undefined ? {} : { [sessionId]: views },
      sessionProjectMounts: projectMounts === undefined ? {} : { [sessionId]: projectMounts },
    }),
    [views, projectMounts, sessionId],
  );
  const mounts = useMemo(
    () => selectWritableMounts({ state: mountState, sessionId }),
    [mountState, sessionId],
  );
  const fallback = useMemo(
    () =>
      findMountById({ mounts, mountId: activeMountId }) ??
      recoverSoleMount({ mounts }) ??
      selectAutomaticTurnMount({ state: mountState, sessionId }),
    [mounts, activeMountId, mountState, sessionId],
  );

  const shouldPrepareScratch = mounts.length === 0 && firstLapProject === null;
  const [scratch, setScratch] = useState<Scratch | null>(null);
  useEffect(() => {
    if (!shouldPrepareScratch) {
      return;
    }
    let isCancelled = false;
    scratchDirPrepare({ sessionId })
      .then((path) => {
        if (!isCancelled) {
          setScratch({ sessionId, path });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setScratch({ sessionId, path: null });
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [shouldPrepareScratch, sessionId]);
  const scratchOfSession = scratch !== null && scratch.sessionId === sessionId ? scratch : null;

  const target = useMemo(
    () =>
      selectExploreMount({
        requestedPath,
        mounts,
        views: views ?? EMPTY_ARRAY,
        fallback,
        projects,
        firstLapProject,
        scratchPath: scratchOfSession?.path ?? null,
      }),
    [requestedPath, mounts, views, fallback, projects, firstLapProject, scratchOfSession],
  );

  const pick = useCallback(
    ({ mountPath }: PickParams) => setExploreMountPath({ sessionId, mountPath }),
    [sessionId, setExploreMountPath],
  );

  const groups = useMemo(
    () =>
      branchMenuGroups({
        mounts,
        currentPath: target.kind === 'mount' ? target.path : null,
        statOf: () => null,
        statusOf: () => null,
        isRequestMergedOf: () => false,
        onSelect: (mount) => pick({ mountPath: mount.worktreePath }),
      }),
    [mounts, target, pick],
  );

  return {
    target,
    isResolving: shouldPrepareScratch && scratchOfSession === null,
    groups,
    rowCount: mounts.length,
    pick,
  };
};
