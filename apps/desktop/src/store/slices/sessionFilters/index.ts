import { getSelectedProjectIds } from './getSelectedProjectIds';
import { setSelectedProjectIds } from './setSelectedProjectIds';
import type { SliceDeps } from '../../slice-types';
import type { SessionFiltersSlice } from './types';

export { NO_PROJECT_FILTER_ID } from './types';
export type { SessionFiltersSlice } from './types';

export const createSessionFiltersSlice = ({ set, get }: SliceDeps): SessionFiltersSlice => ({
  selectedProjectIds: {},
  getSelectedProjectIds: getSelectedProjectIds({ set, get }),
  setSelectedProjectIds: setSelectedProjectIds({ set }),
});
