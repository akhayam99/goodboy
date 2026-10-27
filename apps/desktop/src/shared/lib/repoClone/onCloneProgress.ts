import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { CloneProgress } from './repoCloneTypes';

const PROGRESS_EVENT = 'clone-progress';

type UpdateParams = {
  readonly progress: CloneProgress;
};

type Params = {
  readonly handler: (params: UpdateParams) => void;
};

export const onCloneProgress = async ({ handler }: Params): Promise<UnlistenFn> =>
  listen<CloneProgress>(PROGRESS_EVENT, (event) => handler({ progress: event.payload }));
