import { applySavedProjectModels } from './applySavedProjectModels';
import { discardSavedProjectModels } from './discardSavedProjectModels';
import { loadSavedProjectModels } from './loadSavedProjectModels';
import { savedProjectModelsInitialState } from './state';
import type { SavedProjectModelsSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createSavedProjectModelsSlice = ({
  set,
  get,
}: SliceDeps): SavedProjectModelsSlice => ({
  ...savedProjectModelsInitialState,
  loadSavedProjectModels: loadSavedProjectModels(set),
  applySavedProjectModels: applySavedProjectModels(set, get),
  discardSavedProjectModels: discardSavedProjectModels(set),
});
