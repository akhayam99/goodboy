import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
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
  let queue: Promise<void> = Promise.resolve();
  return ({ change }) => {
    const write = queue.then(async () => {
      const next = change({ current: get().unavailableModels });
      if (next === null) {
        return;
      }
      await setSetting(tauriDatabase, SETTING_UNAVAILABLE_MODELS, JSON.stringify(next));
      set({ unavailableModels: next });
    });
    queue = write.catch(() => undefined);
    return write;
  };
};
