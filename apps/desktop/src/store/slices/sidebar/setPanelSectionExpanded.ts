import type { SessionId } from '@goodboy/types'
import type { GetFn, PanelSection, SetFn } from './types'

export const setPanelSectionExpanded = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId, section: PanelSection, expanded: boolean) => {
    const prev = get().sessionPanelExpanded
    set({
      sessionPanelExpanded: {
        ...prev,
        [sessionId]: { ...prev[sessionId], [section]: expanded },
      },
    })
  }
}
