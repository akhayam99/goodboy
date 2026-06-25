import { deleteWorkspaceIntegration as deleteIntegrationInDb } from '@goodboy/db'
import type { WorkspaceId } from '@goodboy/types'
import { gitlabDisconnect } from '../../../features/integrations/gitlab/client'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const disconnectGitlab = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    await gitlabDisconnect(workspaceId)
    await deleteIntegrationInDb(tauriDatabase, workspaceId, 'gitlab')
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? []
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: current.filter((i) => i.provider !== 'gitlab'),
        },
      }
    })
  }
}
