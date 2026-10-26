import { setProjectValue, type ProjectValueKey } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly projectId: ProjectId;
  readonly key: ProjectValueKey;
  readonly value: string;
};

export const writeProjectValue = () => {
  return ({ projectId, key, value }: Params): Promise<void> =>
    setProjectValue({ db: tauriDatabase, projectId, key, value });
};
