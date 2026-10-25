import type { FolderPurpose, ProjectId } from '@goodboy/types';
import {
  getProjectValue,
  insertProjectValueIfAbsent,
  replaceProjectValueIfUnchanged,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { projectById } from '../projects/projectIndex';
import { FOLDER_PURPOSE_QUEUE_KEY, storeFolderPurpose } from './storeFolderPurpose';
import type { FolderPurposeDeps, SetFolderPurposeParams } from './types';

const MAX_ATTEMPTS = 2;

type AttemptParams = {
  readonly projectId: ProjectId;
  readonly purpose: FolderPurpose;
};

const attempt = async ({ projectId, purpose }: AttemptParams): Promise<boolean> => {
  const db = tauriDatabase;
  const key = 'folder.purpose';
  const raw = await getProjectValue({ db, projectId, key });
  if (raw === purpose) {
    return true;
  }
  if (raw === null) {
    return insertProjectValueIfAbsent({ db, projectId, key, value: purpose });
  }
  return replaceProjectValueIfUnchanged({ db, projectId, key, expected: raw, value: purpose });
};

export const setFolderPurpose = ({ set, get, queue }: FolderPurposeDeps) => {
  return ({ projectId, purpose }: SetFolderPurposeParams): Promise<FolderPurpose> => {
    if (projectById(get().projects, projectId) === undefined) {
      return Promise.reject(new Error('This folder is no longer in a workspace'));
    }
    return queue.run({
      key: FOLDER_PURPOSE_QUEUE_KEY,
      task: async () => {
        for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
          if (await attempt({ projectId, purpose })) {
            storeFolderPurpose({ set, projectId, purpose });
            return purpose;
          }
        }
        throw new Error('What this folder is for kept changing while it was saved');
      },
    });
  };
};
