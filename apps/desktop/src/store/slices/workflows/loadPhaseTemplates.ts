import type { WorkspaceId } from '@goodboy/types'
import { invokeWorkflowList } from '../../../features/workflows/workflows'
import type { SetFn } from './types'

export const loadPhaseTemplates = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const presets = await invokeWorkflowList(workspaceId)
    set((state) => {
      const existing = state.phaseTemplates[workspaceId] ?? []
      const freshIds = new Set(presets.map((p) => p.id))
      const retained = existing.filter(
        (w) => !freshIds.has(w.id) && (w.deletedAt != null || w.isPreset === false),
      )
      return {
        phaseTemplates: { ...state.phaseTemplates, [workspaceId]: [...presets, ...retained] },
      }
    })
  }
}
