import { deleteWorkspaceIntegration as deleteIntegrationInDb } from '@goodboy/db'
import type { WorkspaceId } from '@goodboy/types'
import { sentryDisconnect } from '../../../features/integrations/sentry/client'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const disconnectSentry = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    await sentryDisconnect(workspaceId)
    await deleteIntegrationInDb(tauriDatabase, workspaceId, 'sentry')
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? []
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: current.filter((i) => i.provider !== 'sentry'),
        },
      }
    })
  }
}
