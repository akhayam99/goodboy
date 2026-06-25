import type { WorkspaceId } from '@goodboy/types'
import { invokeStepDefList } from '../../../features/workflows/workflows'
import type { SetFn } from './types'

export const loadStepLibrary = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const defs = await invokeStepDefList(workspaceId)
    set((state) => ({ stepLibrary: { ...state.stepLibrary, [workspaceId]: defs } }))
  }
}
