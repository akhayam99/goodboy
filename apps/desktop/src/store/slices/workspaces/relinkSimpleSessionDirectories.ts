import { updateSessionWorktreePath, type SessionWorktree } from '@goodboy/db';
import type { SessionId, WorkspaceId, WorkspaceKind } from '@goodboy/types';
import {
  scanSimpleSessions,
  simpleSessionDirExists,
  writeSimpleSessionMarker,
  type SimpleSessionScanEntry,
} from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';

type Params = {
  readonly rootPath: string;
  readonly workspaceId: WorkspaceId;
  readonly workspaceKind: WorkspaceKind | undefined;
  readonly worktreesBySession: ReadonlyMap<SessionId, ReadonlyArray<SessionWorktree>>;
};

export const relinkSimpleSessionDirectories = async ({
  rootPath,
  workspaceId,
  workspaceKind,
  worktreesBySession,
}: Params): Promise<Map<SessionId, ReadonlyArray<SessionWorktree>>> => {
  let scanned: ReadonlyArray<SimpleSessionScanEntry>;
  try {
    scanned = await scanSimpleSessions({ rootPath });
  } catch (error) {
    console.warn('[simple-session] directory scan failed', error);
    return new Map(worktreesBySession);
  }

  const workspaceScanned = scanned.filter((entry) => entry.workspaceId === workspaceId);
  const scannedBySession = new Map(workspaceScanned.map((entry) => [entry.sessionId, entry.path]));
  const resolved = new Map<SessionId, ReadonlyArray<SessionWorktree>>();

  await Promise.all(
    [...worktreesBySession].map(async ([sessionId, worktrees]) => {
      const nextWorktrees = await Promise.all(
        worktrees.map(async (worktree) => {
          if (!isBranchlessSession({ workspaceKind, branch: worktree.branch })) {
            return worktree;
          }
          let exists;
          try {
            exists = await simpleSessionDirExists({ path: worktree.worktreePath });
          } catch (error) {
            console.warn('[simple-session] directory check failed', error);
            return worktree;
          }

          if (exists) {
            const hasMarker = workspaceScanned.some(
              (entry) => entry.sessionId === sessionId && entry.path === worktree.worktreePath,
            );
            if (!hasMarker) {
              const hasForeignMarker = scanned.some(
                (entry) => entry.path === worktree.worktreePath && entry.sessionId !== sessionId,
              );
              if (hasForeignMarker) {
                return worktree;
              }
              await writeSimpleSessionMarker({
                path: worktree.worktreePath,
                sessionId,
                workspaceId,
              }).catch((error) => {
                console.warn('[simple-session] marker backfill failed', error);
              });
            }
            return worktree;
          }

          const relinkedPath = scannedBySession.get(sessionId);
          if (relinkedPath == null || relinkedPath === worktree.worktreePath) {
            return worktree;
          }

          await updateSessionWorktreePath({
            db: tauriDatabase,
            sessionId,
            parallelIndex: worktree.parallelIndex,
            worktreePath: relinkedPath,
          });
          console.info(`[simple-session] relinked ${sessionId} to ${relinkedPath}`);
          return { ...worktree, worktreePath: relinkedPath };
        }),
      );
      resolved.set(sessionId, nextWorktrees);
    }),
  );

  return resolved;
};
