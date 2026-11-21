import { useEffect, useMemo } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { buildSessionScripts, type SessionScriptGroup } from '../../buildSessionScripts';
import { useScriptPins } from '../useScriptPins';

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
  const runs = useAppStore((state) => state.scriptRuns[sessionId]);
  const ledger = useAppStore((state) => state.scriptLedger[sessionId]);
  const loadDiscoveredScripts = useAppStore((state) => state.loadDiscoveredScripts);
  const loadScriptLedger = useAppStore((state) => state.loadScriptLedger);
  const pins = useScriptPins({ projectIds: mounts.map((mount) => mount.projectId) });

  const runMoves = Object.values(runs ?? {})
    .map((record) => `${record.runId}:${record.status}`)
    .sort()
    .join('|');

  useEffect(() => {
    if (!shouldScan) {
      return;
    }
    void loadScriptLedger({ sessionId });
  }, [loadScriptLedger, runMoves, sessionId, shouldScan]);

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
    () => buildSessionScripts({ mounts, projects, saved, discovered, pins, runs, ledger }),
    [discovered, ledger, mounts, pins, projects, runs, saved],
  );
  const isReading = mounts.some(
    (mount) =>
      mount.worktreePath !== '' &&
      discovered?.[mount.worktreePath] === undefined &&
      scans?.[mount.worktreePath]?.status !== 'error',
  );
  return { groups, isReading };
};
