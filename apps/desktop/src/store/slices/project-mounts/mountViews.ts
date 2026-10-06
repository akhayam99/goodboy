import { listSessionMounts, type SessionWorktree } from '@goodboy/db';
import type { MountId, SessionId, SessionMountView, SessionProjectMount } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { findMountById } from './findMountById';
import { mountError } from './mountErrors';
import { selectSelectedMountId } from './selectedMountId';
import type { GetFn, SetFn } from './types';
import { projectById } from '../projects/projectIndex';

type LoadParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const loadMountViews = async ({
  get,
  sessionId,
}: LoadParams): Promise<ReadonlyArray<SessionMountView>> => {
  const mounts = await listSessionMounts({ db: tauriDatabase, sessionId });
  const projects = get().projects;
  return mounts.flatMap((mount) => {
    const projectId = mount.projectId;
    if (projectId === null) {
      return [];
    }
    const project = projectById(projects, projectId);
    if (project === undefined) {
      return [];
    }
    return [
      {
        ...mount,
        projectId,
        mountName: mount.mountName ?? project.name,
        repoRoot: project.rootPath,
      },
    ];
  });
};

const toProjectMount = (view: SessionMountView): SessionProjectMount | null => {
  const worktreePath = view.worktreePath;
  if (worktreePath === null || !view.isAttached) {
    return null;
  }
  return {
    mountId: view.id,
    sessionId: view.sessionId,
    projectId: view.projectId,
    mountName: view.mountName,
    worktreePath,
    lastWorktreePath: view.lastWorktreePath,
    repoRoot: view.repoRoot,
    branch: view.branch,
    baseBranch: view.baseBranch,
    parallelIndex: view.parallelIndex,
    isAttached: true,
    diskState: view.diskState,
    revision: view.revision,
  };
};

export const toProjectMounts = (
  views: ReadonlyArray<SessionMountView>,
): ReadonlyArray<SessionProjectMount> =>
  views.flatMap((view) => {
    const mount = toProjectMount(view);
    return mount === null ? [] : [mount];
  });

const toWorktreeRecord = (view: SessionMountView): SessionWorktree | null => {
  const worktreePath = view.worktreePath;
  if (
    worktreePath === null ||
    !view.isAttached ||
    view.diskState === 'missing' ||
    view.diskState === 'removed'
  ) {
    return null;
  }
  return {
    id: view.id,
    sessionId: view.sessionId,
    worktreePath,
    branch: view.branch,
    parallelIndex: view.parallelIndex,
    projectId: view.projectId,
    mountName: view.mountName,
    ...(view.repoSlug === null ? {} : { repoSlug: view.repoSlug }),
    revision: view.revision,
    ...(view.branchOrigin === undefined ? {} : { branchOrigin: view.branchOrigin }),
    createdAt: Date.parse(view.createdAt),
  };
};

const toWorktreeRecords = (
  views: ReadonlyArray<SessionMountView>,
): ReadonlyArray<SessionWorktree> =>
  views.flatMap((view) => {
    const record = toWorktreeRecord(view);
    return record === null ? [] : [record];
  });

type ApplyParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly views: ReadonlyArray<SessionMountView>;
};

export const applyMountViews = ({ set, sessionId, views }: ApplyParams): void => {
  const mounts = toProjectMounts(views);
  set((state) => {
    const active = findMountById({
      mounts,
      mountId: selectSelectedMountId({ state, sessionId }),
    });
    const sessionBranches = { ...state.sessionBranches };
    if (active === null) {
      delete sessionBranches[sessionId];
    } else {
      sessionBranches[sessionId] = active.branch;
    }
    return {
      sessionMounts: { ...state.sessionMounts, [sessionId]: views },
      sessionWorktreeRecords: {
        ...state.sessionWorktreeRecords,
        [sessionId]: toWorktreeRecords(views),
      },
      sessionProjectMounts: { ...state.sessionProjectMounts, [sessionId]: mounts },
      sessionBranches,
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [sessionId]: mounts.map((mount) => mount.worktreePath),
      },
    };
  });
};

type RequireParams = {
  readonly views: ReadonlyArray<SessionMountView>;
  readonly mountId: MountId;
};

export const requireMountView = ({ views, mountId }: RequireParams): SessionMountView => {
  const view = views.find((candidate) => candidate.id === mountId);
  if (view === undefined) {
    throw mountError({ code: 'mount-missing', message: `mount not found: ${mountId}`, mountId });
  }
  return view;
};
