import { deleteWorkspaceIntegration as deleteIntegrationInDb } from '@goodboy/db'
import type { WorkspaceId } from '@goodboy/types'
import { linearDisconnect } from '../../../features/integrations/linear/client'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const disconnectLinear = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    await linearDisconnect(workspaceId)
    await deleteIntegrationInDb(tauriDatabase, workspaceId, 'linear')
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? []
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: current.filter((i) => i.provider !== 'linear'),
        },
      }
    })
  }
}
