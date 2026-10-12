import type { HiddenPort } from '@goodboy/core';
import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { commitAfterConfirm } from '../state-writes/commitAfterConfirm';
import { HIDDEN_PORTS_KEY } from './settingKeys';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly next: ReadonlyArray<HiddenPort>;
  readonly failureTitle: string;
};

export const writeHiddenPorts = async ({
  set,
  get,
  next,
  failureTitle,
}: Params): Promise<boolean> => {
  const result = await commitAfterConfirm({
    get,
    failureTitle,
    target: {},
    step: () => setSetting(tauriDatabase, HIDDEN_PORTS_KEY, JSON.stringify(next)),
    commit: () => set({ monitorHidden: next }),
  });
  return result.isOk;
};
