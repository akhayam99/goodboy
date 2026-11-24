import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';
import type { SliceDeps } from '../../slice-types';
import { SETTING_UNAVAILABLE_MODELS, type UnavailableModel } from './unavailableModelsSetting';

type ChangeParams = {
  readonly current: ReadonlyArray<UnavailableModel>;
};

export type UnavailableModelsChange = (
  params: ChangeParams,
) => ReadonlyArray<UnavailableModel> | null;

type WriteParams = {
  readonly change: UnavailableModelsChange;
};

export type UnavailableModelsWrite = (params: WriteParams) => Promise<void>;

export const unavailableModelsWriter = ({ set, get }: SliceDeps): UnavailableModelsWrite => {
  const queue = createSerialQueue();
  return ({ change }) =>
    queue.run({
      key: SETTING_UNAVAILABLE_MODELS,
      task: async () => {
        const next = change({ current: get().unavailableModels });
        if (next === null) {
          return;
        }
        await setSetting(tauriDatabase, SETTING_UNAVAILABLE_MODELS, JSON.stringify(next));
        set({ unavailableModels: next });
      },
    });
};
