import type { FolderPurpose } from '@goodboy/types';
import { getProjectValue } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { parseFolderPurpose } from './parseFolderPurpose';
import { FOLDER_PURPOSE_QUEUE_KEY, storeFolderPurpose } from './storeFolderPurpose';
import type { FolderPurposeDeps, LoadFolderPurposeParams } from './types';

export const loadFolderPurpose = ({ set, queue }: FolderPurposeDeps) => {
  return ({ projectId }: LoadFolderPurposeParams): Promise<FolderPurpose | null> =>
    queue.run({
      key: FOLDER_PURPOSE_QUEUE_KEY,
      task: async () => {
        const raw = await getProjectValue({
          db: tauriDatabase,
          projectId,
          key: 'folder.purpose',
        });
        const purpose = parseFolderPurpose({ raw });
        storeFolderPurpose({ set, projectId, purpose });
        return purpose;
      },
    });
};
