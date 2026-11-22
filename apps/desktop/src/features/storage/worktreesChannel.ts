import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../../shared/lib/isTauriRuntime';

export const WORKTREES_CHANGED_EVENT = 'goodboy:worktrees-changed';

type ReposParams = {
  readonly repoRoots: ReadonlyArray<string>;
};

type ListenParams = {
  readonly onChange: (params: ReposParams) => void;
};

type PayloadParams = {
  readonly payload: unknown;
};

const repoRootsOf = ({ payload }: PayloadParams): ReadonlyArray<string> => {
  if (typeof payload !== 'object' || payload === null || !('repoRoots' in payload)) {
    return [];
  }
  const raw: unknown = payload.repoRoots;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((root): root is string => typeof root === 'string' && root !== '');
};

export const worktreesChannel = {
  announce: async ({ repoRoots }: ReposParams): Promise<void> => {
    if (!isTauriRuntime() || repoRoots.length === 0) {
      return;
    }
    await emit(WORKTREES_CHANGED_EVENT, { repoRoots: [...new Set(repoRoots)] });
  },
  listen: async ({ onChange }: ListenParams): Promise<UnlistenFn> => {
    if (!isTauriRuntime()) {
      return () => undefined;
    }
    return listen<unknown>(WORKTREES_CHANGED_EVENT, (event) => {
      const repoRoots = repoRootsOf({ payload: event.payload });
      if (repoRoots.length > 0) {
        onChange({ repoRoots });
      }
    });
  },
};
