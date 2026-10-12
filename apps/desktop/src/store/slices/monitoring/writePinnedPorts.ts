import type { PinnedPort } from '@goodboy/core';
import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { commitAfterConfirm } from '../state-writes/commitAfterConfirm';
import { PINNED_PORTS_KEY } from './settingKeys';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly next: ReadonlyArray<PinnedPort>;
  readonly failureTitle: string;
};

export const writePinnedPorts = async ({
  set,
  get,
  next,
  failureTitle,
}: Params): Promise<boolean> => {
  const result = await commitAfterConfirm({
    get,
    failureTitle,
    target: {},
    step: () => setSetting(tauriDatabase, PINNED_PORTS_KEY, JSON.stringify(next)),
    commit: () => set({ monitorPinned: next }),
  });
  return result.isOk;
};
