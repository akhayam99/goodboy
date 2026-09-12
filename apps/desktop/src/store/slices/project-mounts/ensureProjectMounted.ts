import { listWorktreesForSession } from '@goodboy/db';
import type { MountId, Session, SessionId, SessionProjectMount } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { AppState } from '../../types';
import { commitWriteDestination } from './commitWriteDestination';
import { createProjectMount, withWorktreeRecord } from './createProjectMount';
import { withMountLock } from './mountLocks';
import { mountViewPatch } from './mountViewPatch';
import { recoverSoleMount } from './recoverSoleMount';
import { selectSelectedMountId } from './selectedMountId';
import { selectWritableMounts } from './selectors';
import type { EnsureProjectMountedInput, EnsureProjectMountedResult, GetFn, SetFn } from './types';

const inFlight = new Map<string, Promise<EnsureProjectMountedResult>>();

type SessionParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

const sessionOf = ({ get, sessionId }: SessionParams): Session => {
  const session =
    get().sessions.find((candidate) => candidate.id === sessionId) ??
    Object.values(get().archivedSessions)
      .flat()
      .find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    throw new Error(`session not found: ${sessionId}`);
  }
  return session;
};

type DestinationParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

const persistSoleDestination = async ({
  set,
  get,
  sessionId,
}: DestinationParams): Promise<void> => {
  if (selectSelectedMountId({ state: get(), sessionId }) !== null) {
    return;
  }
  const sole = recoverSoleMount({ mounts: selectWritableMounts({ state: get(), sessionId }) });
  if (sole === null) {
    return;
  }
  await commitWriteDestination({ set, sessionId, mount: sole, previousSelection: 'held' });
};

export const ensureProjectMounted = (set: SetFn, get: GetFn) => {
  const run = async ({
    sessionId,
    projectId,
    reason,
    taskIdentifiers,
    mountId: plannedMountId,
    requestId,
    slug,
  }: EnsureProjectMountedInput): Promise<EnsureProjectMountedResult> => {
    const trimmedReason = reason.trim();
    if (trimmedReason === '') {
      throw new Error('materializing a project requires a reason');
    }
    const session = sessionOf({ get, sessionId });
    const project = get().projects.find((candidate) => candidate.id === projectId);
    if (project === undefined || project.workspaceId !== session.workspaceId) {
      throw new Error(`project not found in this workspace: ${projectId}`);
    }
    const known = (get().sessionProjectMounts[sessionId] ?? []).filter(
      (mount) => mount.projectId === projectId,
    );
    if (known.length > 0) {
      return {
        status: 'already-mounted',
        mountIds: known.map((mount) => mount.mountId),
      };
    }
    const rows = await listWorktreesForSession(tauriDatabase, sessionId);
    const persistedRows = rows.filter((row) => row.projectId === projectId);
    if (persistedRows.length > 0) {
      const adopted: ReadonlyArray<SessionProjectMount> = persistedRows.map((row) => ({
        mountId: row.id as MountId,
        sessionId,
        projectId,
        mountName: row.mountName ?? project.name,
        worktreePath: row.worktreePath,
        lastWorktreePath: row.worktreePath,
        repoRoot: project.rootPath,
        branch: row.branch,
        baseBranch: project.baseBranch ?? null,
        parallelIndex: row.parallelIndex,
        isAttached: true,
        diskState: 'present',
        revision: row.revision ?? 0,
      }));
      set((state) => {
        const views = adopted.reduce<Partial<Pick<AppState, 'sessionMounts'>>>(
          (patch, mount) => ({
            ...patch,
            ...mountViewPatch({
              state: { sessionMounts: patch.sessionMounts ?? state.sessionMounts },
              sessionId,
              mount,
            }),
          }),
          {},
        );
        return {
          sessionProjectMounts: {
            ...state.sessionProjectMounts,
            [sessionId]: [...(state.sessionProjectMounts[sessionId] ?? []), ...adopted],
          },
          sessionWorktrees: {
            ...state.sessionWorktrees,
            [sessionId]: [
              ...(state.sessionWorktrees[sessionId] ?? []),
              ...adopted.map((mount) => mount.worktreePath),
            ],
          },
          sessionWorktreeRecords: persistedRows.reduce(
            (current, record) => withWorktreeRecord({ current, sessionId, record }),
            state.sessionWorktreeRecords,
          ),
          ...views,
        };
      });
      await persistSoleDestination({ set, get, sessionId });
      return {
        status: 'already-mounted',
        mountIds: adopted.map((mount) => mount.mountId),
      };
    }
    const mountId = plannedMountId ?? (crypto.randomUUID() as MountId);
    const mount = await withMountLock({
      key: `session:${sessionId}`,
      run: async () => {
        const allocated = await listWorktreesForSession(tauriDatabase, sessionId);
        return createProjectMount({
          set,
          get,
          session,
          project,
          mountId,
          requestId: requestId ?? mountId,
          reason: trimmedReason,
          parallelIndex: allocated.reduce((max, row) => Math.max(max, row.parallelIndex), 0) + 1,
          ...(taskIdentifiers === undefined ? {} : { taskIdentifiers }),
          ...(slug === undefined ? {} : { slug }),
        });
      },
    });
    await persistSoleDestination({ set, get, sessionId });
    return { status: 'created', createdMountId: mount.mountId, mountIds: [mount.mountId] };
  };
  return async (input: EnsureProjectMountedInput): Promise<EnsureProjectMountedResult> => {
    const key = `${input.sessionId}:${input.projectId}`;
    const pending = inFlight.get(key);
    if (pending !== undefined) {
      return pending;
    }
    const promise = run(input).finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, promise);
    return promise;
  };
};
