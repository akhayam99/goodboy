import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { dismissFolderGitNotice } from './dismissFolderGitNotice';
import { hydrateFolderPurposes } from './hydrateFolderPurposes';
import { keepFolderInPlace } from './keepFolderInPlace';
import { loadFirstCommitPlan } from './loadFirstCommitPlan';
import { loadFolderPurpose } from './loadFolderPurpose';
import { probeFolderGit } from './probeFolderGit';
import { scanFolderSignals } from './scanFolderSignals';
import { setFolderPurpose } from './setFolderPurpose';
import { folderPurposeInitialState } from './state';
import { switchFolderToRepo } from './switchFolderToRepo';
import type { FolderPurposeSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createFolderPurposeSlice = ({ set, get }: SliceDeps): FolderPurposeSlice => {
  const queue = createKeyedQueue();
  const latest = createLatestOnly();
  return {
    ...folderPurposeInitialState,
    hydrateFolderPurposes: hydrateFolderPurposes({ set, get, queue }),
    loadFolderPurpose: loadFolderPurpose({ set, get, queue }),
    setFolderPurpose: setFolderPurpose({ set, get, queue }),
    scanFolderSignals: scanFolderSignals({ set, get, latest }),
    probeFolderGit: probeFolderGit({ set, get, latest }),
    loadFirstCommitPlan: loadFirstCommitPlan({ set, get, latest }),
    keepFolderInPlace: keepFolderInPlace({ set, get }),
    switchFolderToRepo: switchFolderToRepo({ set, get }),
    dismissFolderGitNotice: dismissFolderGitNotice({ set, get }),
  };
};
