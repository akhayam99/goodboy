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

const WINDOW_SOURCE = crypto.randomUUID();

const localListeners = new Set<(params: ReposParams) => void>();

const isFromThisWindow = ({ payload }: PayloadParams): boolean =>
  typeof payload === 'object' &&
  payload !== null &&
  'source' in payload &&
  payload.source === WINDOW_SOURCE;

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
    if (repoRoots.length === 0) {
      return;
    }
    const unique = [...new Set(repoRoots)];
    for (const onChange of [...localListeners]) {
      onChange({ repoRoots: unique });
    }
    if (!isTauriRuntime()) {
      return;
    }
    await emit(WORKTREES_CHANGED_EVENT, { repoRoots: unique, source: WINDOW_SOURCE });
  },
  listen: async ({ onChange }: ListenParams): Promise<UnlistenFn> => {
    const stopRemote = isTauriRuntime()
      ? await listen<unknown>(WORKTREES_CHANGED_EVENT, (event) => {
          if (isFromThisWindow({ payload: event.payload })) {
            return;
          }
          const repoRoots = repoRootsOf({ payload: event.payload });
          if (repoRoots.length > 0) {
            onChange({ repoRoots });
          }
        })
      : () => undefined;
    localListeners.add(onChange);
    return () => {
      localListeners.delete(onChange);
      stopRemote();
    };
  },
};
