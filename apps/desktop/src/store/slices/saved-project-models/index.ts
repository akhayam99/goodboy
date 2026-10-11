import { createLatestOnly } from '../state-writes/latestOnly';
import { applySavedProjectModels } from './applySavedProjectModels';
import { discardSavedProjectModels } from './discardSavedProjectModels';
import { loadSavedProjectModels } from './loadSavedProjectModels';
import { savedProjectModelsInitialState } from './state';
import type { SavedProjectModelsSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createSavedProjectModelsSlice = ({ set, get }: SliceDeps): SavedProjectModelsSlice => {
  const latest = createLatestOnly();
  return {
    ...savedProjectModelsInitialState,
    loadSavedProjectModels: loadSavedProjectModels({ set, latest }),
    applySavedProjectModels: applySavedProjectModels({ set, get, latest }),
    discardSavedProjectModels: discardSavedProjectModels({ set, latest }),
  };
};
