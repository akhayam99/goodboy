import type { IsoDateTime, SessionId } from '@goodboy/types'
import { gitlabMrForBranch } from '../../../features/integrations/gitlab/client'
import { formatError } from '../../../shared/lib/errors'
import { resolveMrContext } from './resolveMrContext'
import type { GetFn, SetFn } from './types'

export const refreshSessionMr = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, opts?: { force?: boolean; silent?: boolean }) => {
    if (!opts?.force && get().sessionGitlabMr[sessionId]?.loading) {
      return
    }
    const ctx = await resolveMrContext(get, sessionId)
    if (!ctx) {
      return
    }
    set((state) => ({
      sessionGitlabMr: {
        ...state.sessionGitlabMr,
        [sessionId]: {
          mr: state.sessionGitlabMr[sessionId]?.mr ?? null,
          fetchedAt: state.sessionGitlabMr[sessionId]?.fetchedAt ?? null,
          loading: true,
          error: null,
        },
      },
    }))
    try {
      const mr = await gitlabMrForBranch(ctx.workspaceId, ctx.host, ctx.projectPath, ctx.branch)
      set((state) => ({
        sessionGitlabMr: {
          ...state.sessionGitlabMr,
          [sessionId]: {
            mr,
            fetchedAt: new Date().toISOString() as IsoDateTime,
            loading: false,
            error: null,
          },
        },
      }))
    } catch (err) {
      set((state) => ({
        sessionGitlabMr: {
          ...state.sessionGitlabMr,
          [sessionId]: {
            mr: state.sessionGitlabMr[sessionId]?.mr ?? null,
            fetchedAt: state.sessionGitlabMr[sessionId]?.fetchedAt ?? null,
            loading: false,
            error: opts?.silent ? null : formatError(err),
          },
        },
      }))
    }
  }
}
