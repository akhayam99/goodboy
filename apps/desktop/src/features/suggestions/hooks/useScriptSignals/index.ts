import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { SignalScriptRun, SignalScripts } from '../../nextStepSignals';

type Params = {
  readonly sessionId: SessionId;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly wantedMountIds: ReadonlyArray<MountId>;
};

export type ScriptSignals = {
  readonly scripts: ReadonlyArray<SignalScripts>;
  readonly scriptRuns: ReadonlyArray<SignalScriptRun>;
};

export const useScriptSignals = ({ sessionId, mounts, wantedMountIds }: Params): ScriptSignals => {
  const discovered = useAppStore((state) => state.discoveredScripts[sessionId]);
  const runs = useAppStore(useShallow((state) => state.scriptRuns[sessionId]));
  const loadDiscoveredScripts = useAppStore((state) => state.loadDiscoveredScripts);
  const wantedKey = wantedMountIds.join(',');
  useEffect(() => {
    for (const mount of mounts) {
      if (wantedKey.split(',').includes(mount.mountId)) {
        void loadDiscoveredScripts({ sessionId, worktreePath: mount.worktreePath });
      }
    }
  }, [loadDiscoveredScripts, mounts, sessionId, wantedKey]);
  const scripts = useMemo(
    () =>
      mounts.flatMap((mount): ReadonlyArray<SignalScripts> => {
        const groups = discovered?.[mount.worktreePath];
        return !Array.isArray(groups)
          ? []
          : [{ mountId: mount.mountId, worktreePath: mount.worktreePath, groups }];
      }),
    [discovered, mounts],
  );
  const scriptRuns = useMemo(
    () =>
      Object.values(runs ?? {}).flatMap((run): ReadonlyArray<SignalScriptRun> =>
        run.status === 'pending' || run.name === undefined
          ? []
          : [
              {
                mountId: run.mountId ?? null,
                name: run.name,
                isOk: run.status === 'ok',
                completedAt: run.completedAt ?? run.startedAt,
              },
            ],
      ),
    [runs],
  );
  return { scripts, scriptRuns };
};
