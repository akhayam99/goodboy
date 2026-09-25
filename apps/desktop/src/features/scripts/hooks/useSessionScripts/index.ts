import { useEffect, useMemo } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { buildSessionScripts, type SessionScriptGroup } from '../../buildSessionScripts';

type Params = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId | null;
  readonly shouldScan: boolean;
};

export type SessionScripts = {
  readonly groups: ReadonlyArray<SessionScriptGroup>;
  readonly isReading: boolean;
};

export const useSessionScripts = ({
  sessionId,
  workspaceId,
  shouldScan,
}: Params): SessionScripts => {
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const projects = useAppStore((state) => state.projects);
  const saved = useAppStore((state) =>
    workspaceId === null ? EMPTY_ARRAY : (state.projectScripts[workspaceId] ?? EMPTY_ARRAY),
  );
  const discovered = useAppStore((state) => state.discoveredScripts[sessionId]);
  const scans = useAppStore((state) => state.discoveredScriptScans[sessionId]);
  const loadDiscoveredScripts = useAppStore((state) => state.loadDiscoveredScripts);

  useEffect(() => {
    if (!shouldScan) {
      return;
    }
    for (const mount of mounts) {
      if (mount.worktreePath !== '') {
        void loadDiscoveredScripts({ sessionId, worktreePath: mount.worktreePath });
      }
    }
  }, [loadDiscoveredScripts, mounts, sessionId, shouldScan]);

  const groups = useMemo(
    () => buildSessionScripts({ mounts, projects, saved, discovered }),
    [discovered, mounts, projects, saved],
  );
  const isReading = mounts.some(
    (mount) =>
      mount.worktreePath !== '' &&
      discovered?.[mount.worktreePath] === undefined &&
      scans?.[mount.worktreePath]?.status !== 'error',
  );
  return { groups, isReading };
};
