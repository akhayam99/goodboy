import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { scanProjectScripts } from '../../../features/scripts/scripts';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly force: boolean;
};

export const scanDiscoveredScripts = async ({
  set,
  get,
  sessionId,
  worktreePath,
  force,
}: Params): Promise<void> => {
  const current = get().discoveredScriptScans[sessionId]?.[worktreePath];
  const cached = get().discoveredScripts[sessionId]?.[worktreePath];
  if (current?.status === 'loading' || (!force && cached !== undefined)) {
    return;
  }
  set((state) => ({
    discoveredScriptScans: {
      ...state.discoveredScriptScans,
      [sessionId]: {
        ...state.discoveredScriptScans[sessionId],
        [worktreePath]: { status: 'loading', error: null },
      },
    },
  }));
  try {
    const groups = await scanProjectScripts({ worktreePath });
    set((state) => ({
      discoveredScripts: {
        ...state.discoveredScripts,
        [sessionId]: { ...state.discoveredScripts[sessionId], [worktreePath]: groups },
      },
      discoveredScriptScans: {
        ...state.discoveredScriptScans,
        [sessionId]: {
          ...state.discoveredScriptScans[sessionId],
          [worktreePath]: { status: 'ready', error: null },
        },
      },
    }));
  } catch (caughtError) {
    set((state) => ({
      discoveredScriptScans: {
        ...state.discoveredScriptScans,
        [sessionId]: {
          ...state.discoveredScriptScans[sessionId],
          [worktreePath]: { status: 'error', error: formatError(caughtError) },
        },
      },
    }));
  }
};
