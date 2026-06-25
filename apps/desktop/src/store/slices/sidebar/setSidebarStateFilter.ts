import type { TurnState } from '@goodboy/types'
import type { SetFn } from './types'

export const setSidebarStateFilter = (set: SetFn) => {
  return (states: ReadonlyArray<TurnState['kind']>) => set({ sidebarStateFilter: states })
}
