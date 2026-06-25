import type { StepDefId, WorkspaceId } from '@goodboy/types'
import { invokeStepDefDelete, invokeStepDefList } from '../../../features/workflows/workflows'
import type { SetFn } from './types'

export const deleteStepDef = (set: SetFn) => {
  return async (id: StepDefId, listWorkspaceId: WorkspaceId) => {
    await invokeStepDefDelete(id)
    const defs = await invokeStepDefList(listWorkspaceId)
    set((state) => ({ stepLibrary: { ...state.stepLibrary, [listWorkspaceId]: defs } }))
  }
}
