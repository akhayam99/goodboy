import type { Session, SessionMountView, SessionProjectMount } from '@goodboy/types';

export type OwnedMount = {
  readonly mountId: string;
  readonly sessionId: string;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
  readonly worktreePath: string;
  readonly branch: string;
  readonly isLive: boolean;
};

type DiskParams = {
  readonly diskState: string;
};

const isLiveDisk = ({ diskState }: DiskParams): boolean =>
  diskState !== 'missing' && diskState !== 'removed';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionMounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
  readonly sessionProjectMounts: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>>;
};

export const ownedMountsOf = ({
  sessions,
  sessionMounts,
  sessionProjectMounts,
}: Params): ReadonlyArray<OwnedMount> => {
  const workspaceOf = new Map<string, string>();
  for (const session of sessions) {
    workspaceOf.set(session.id, session.workspaceId);
  }
  const byMount = new Map<string, OwnedMount>();
  for (const mounts of Object.values(sessionProjectMounts)) {
    for (const mount of mounts) {
      byMount.set(mount.mountId, {
        mountId: mount.mountId,
        sessionId: mount.sessionId,
        workspaceId: workspaceOf.get(mount.sessionId) ?? null,
        projectId: mount.projectId,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        isLive: isLiveDisk({ diskState: mount.diskState }),
      });
    }
  }
  for (const mounts of Object.values(sessionMounts)) {
    for (const mount of mounts) {
      if (mount.worktreePath === null) {
        continue;
      }
      byMount.set(mount.id, {
        mountId: mount.id,
        sessionId: mount.sessionId,
        workspaceId: workspaceOf.get(mount.sessionId) ?? null,
        projectId: mount.projectId,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        isLive: isLiveDisk({ diskState: mount.diskState }),
      });
    }
  }
  return [...byMount.values()];
};
