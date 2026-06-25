import { getSessionViewPrefs } from './getSessionViewPrefs'
import { setSessionGroup } from './setSessionGroup'
import { setSessionSort } from './setSessionSort'
import {
  lensGo,
  setActiveLens,
  setFocusedPlanId,
  setFocusedWorkflowRun,
  setSessionStudio,
  toggleWorkflowExpand,
} from './workSurface'
import type { GetFn, SessionViewSlice, SetFn } from './types'

export { sortAndGroupSessions } from './sortAndGroupSessions'
export { deriveSessionStage } from './deriveSessionStage'
export { readPersistedLens } from './workSurfaceStorage'
export { LENS_KINDS } from './types'
export type { GroupedSessions, SessionViewSlice } from './types'
export type { SessionStudio, LensKind, LensHistory } from './types'

export const createSessionViewSlice = (set: SetFn, get: GetFn): SessionViewSlice => {
  return {
    sessionViewPrefs: {},
    activeLens: {},
    lensHistory: {},
    focusedPlanId: {},
    sessionStudio: {},
    workflowExpand: {},
    focusedWorkflowRunId: {},
    getSessionViewPrefs: getSessionViewPrefs(set, get),
    setSessionSort: setSessionSort(set, get),
    setSessionGroup: setSessionGroup(set, get),
    setActiveLens: setActiveLens(set),
    lensGo: lensGo(set, get),
    toggleWorkflowExpand: toggleWorkflowExpand(set),
    setFocusedWorkflowRun: setFocusedWorkflowRun(set),
    setFocusedPlanId: setFocusedPlanId(set),
    setSessionStudio: setSessionStudio(set),
  }
}
