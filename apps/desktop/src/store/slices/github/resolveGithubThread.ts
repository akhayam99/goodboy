import type { SessionId } from '@goodboy/types'
import { formatError } from '../../../shared/lib/errors'
import { markThreadResolvedNoPush } from './markThreadResolvedNoPush'
import { pushSessionBranch } from './pushSessionBranch'
import type { GetFn, SetFn } from './types'

type Params = { commitSha?: string; reason?: string }

export const resolveGithubThread = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, threadId: string, closure?: Params): Promise<boolean> => {
    const session = get().sessions.find((s) => s.id === sessionId)
    if (!session) {
      return false
    }
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId)
    const notifyTarget = { sessionId, ...(workspace && { workspaceId: workspace.id }) }
    try {
      if (closure?.commitSha) {
        const push = await pushSessionBranch(get, sessionId)
        if (!push.ok) {
          void get().emitNotification(
            'error',
            'error',
            'push failed, thread left open',
            push.error,
            notifyTarget,
          )
          return false
        }
      }
      await markThreadResolvedNoPush(get, sessionId, threadId, closure)
      await get().refreshSessionPrDetail(sessionId, { force: true })
      return true
    } catch (err) {
      void get().emitNotification(
        'error',
        'error',
        'resolve thread failed',
        formatError(err),
        notifyTarget,
      )
      return false
    }
  }
}
