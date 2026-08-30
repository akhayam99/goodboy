import { getSelectedProjectIds } from './getSelectedProjectIds';
import { setSelectedProjectIds } from './setSelectedProjectIds';
import type { GetFn, SetFn, SessionFiltersSlice } from './types';

export { NO_PROJECT_FILTER_ID } from './types';
export { sessionMatchesProjectFilter } from './sessionMatchesProjectFilter';
export type { SessionFiltersSlice } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const createSessionFiltersSlice = ({ set, get }: Params): SessionFiltersSlice => ({
  selectedProjectIds: {},
  getSelectedProjectIds: getSelectedProjectIds({ set, get }),
  setSelectedProjectIds: setSelectedProjectIds({ set }),
});
