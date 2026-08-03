import { getSessionViewPrefs } from './getSessionViewPrefs';
import { createInitialSessionViewState } from './createInitialSessionViewState';
import { setSessionGroup } from './setSessionGroup';
import { setSessionSort } from './setSessionSort';
import {
  lensGo,
  setActiveLens,
  setDiffFocus,
  setFocusedPlanId,
  setFocusedWorkflowRun,
  setSessionStudio,
  toggleWorkflowExpand,
} from './workSurface';
import type { GetFn, SessionViewSlice, SetFn } from './types';

export { sortAndGroupSessions } from './sortAndGroupSessions';
export { deriveSessionStage } from './deriveSessionStage';
export { isPrReviewSession } from './isPrReviewSession';
export { readPersistedLens } from './workSurfaceStorage';
export { LENS_KINDS } from './types';
export type { GroupedSessions, SessionViewSlice } from './types';
export type { SessionStudio, LensKind, LensHistory, DiffFocus } from './types';

export const createSessionViewSlice = (set: SetFn, get: GetFn): SessionViewSlice => {
  return {
    ...createInitialSessionViewState({}),
    getSessionViewPrefs: getSessionViewPrefs(set, get),
    setSessionSort: setSessionSort(set, get),
    setSessionGroup: setSessionGroup(set, get),
    setActiveLens: setActiveLens(set),
    lensGo: lensGo(set, get),
    toggleWorkflowExpand: toggleWorkflowExpand(set),
    setFocusedWorkflowRun: setFocusedWorkflowRun(set),
    setFocusedPlanId: setFocusedPlanId(set),
    setSessionStudio: setSessionStudio(set),
    setDiffFocus: setDiffFocus(set),
  };
};
