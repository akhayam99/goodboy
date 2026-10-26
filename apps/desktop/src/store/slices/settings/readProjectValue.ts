import { getProjectValue, type ProjectValueKey } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly projectId: ProjectId;
  readonly key: ProjectValueKey;
};

export const readProjectValue = () => {
  return ({ projectId, key }: Params): Promise<string | null> =>
    getProjectValue({ db: tauriDatabase, projectId, key });
};
