import type { SetFn } from './types';

export type SetUpdateQueuedUntilIdleParams = {
  readonly queued: boolean;
};

export const setUpdateQueuedUntilIdle = (set: SetFn) => {
  return ({ queued }: SetUpdateQueuedUntilIdleParams): void => {
    set({ updateQueuedUntilIdle: queued });
  };
};
