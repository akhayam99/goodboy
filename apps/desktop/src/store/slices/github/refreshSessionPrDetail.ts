import { detectRepoSlug, fetchPrDetail } from '@goodboy/core'
import type { IsoDateTime, SessionId } from '@goodboy/types'
import { tauriGhRunner } from '../../../features/github/github'
import { formatError } from '../../../shared/lib/errors'
import type { GetFn, SetFn } from './types'

type Params = {
  force?: boolean
  silent?: boolean
  retries?: number
}

const DETAIL_TTL_MS = 30_000

export const refreshSessionPrDetail = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, opts?: Params) => {
    const existing = get().sessionGithub[sessionId]
    const pr = existing?.pr ?? null
    if (!pr) {
      return
    }
    if (!opts?.force && existing?.detailLoading) {
      return
    }
    const session = get().sessions.find((s) => s.id === sessionId)
    if (!session) {
      return
    }
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId)
    if (!workspace) {
      return
    }
    const fresh = existing?.detailFetchedAt
      ? Date.now() - new Date(existing.detailFetchedAt).getTime()
      : Number.POSITIVE_INFINITY
    if (!opts?.force && existing?.detail && fresh < DETAIL_TTL_MS) {
      return
    }
    set((state) => ({
      sessionGithub: {
        ...state.sessionGithub,
        [sessionId]: {
          pr: state.sessionGithub[sessionId]?.pr ?? pr,
          linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
          fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
          loading: state.sessionGithub[sessionId]?.loading ?? false,
          error: state.sessionGithub[sessionId]?.error ?? null,
          detail: state.sessionGithub[sessionId]?.detail ?? null,
          detailFetchedAt: state.sessionGithub[sessionId]?.detailFetchedAt ?? null,
          detailLoading: true,
          detailError: null,
        },
      },
    }))
    const maxAttempts = (opts?.retries ?? 0) + 1
    let lastErr: unknown = null
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const slug = await detectRepoSlug(tauriGhRunner, workspace.rootPath, session.workspaceId)
        if (!slug) {
          set((state) => ({
            sessionGithub: {
              ...state.sessionGithub,
              [sessionId]: {
                pr: state.sessionGithub[sessionId]?.pr ?? pr,
                linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
                fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
                loading: state.sessionGithub[sessionId]?.loading ?? false,
                error: state.sessionGithub[sessionId]?.error ?? null,
                detail: null,
                detailFetchedAt: new Date().toISOString() as IsoDateTime,
                detailLoading: false,
                detailError: null,
              },
            },
          }))
          return
        }
        const detail = await fetchPrDetail(tauriGhRunner, slug, pr.number, {
          cwd: workspace.rootPath,
          workspaceId: session.workspaceId,
        })
        set((state) => ({
          sessionGithub: {
            ...state.sessionGithub,
            [sessionId]: {
              pr: state.sessionGithub[sessionId]?.pr ?? pr,
              linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
              fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
              loading: state.sessionGithub[sessionId]?.loading ?? false,
              error: state.sessionGithub[sessionId]?.error ?? null,
              detail,
              detailFetchedAt: new Date().toISOString() as IsoDateTime,
              detailLoading: false,
              detailError: null,
            },
          },
        }))
        return
      } catch (err) {
        lastErr = err
      }
    }
    set((state) => ({
      sessionGithub: {
        ...state.sessionGithub,
        [sessionId]: {
          pr: state.sessionGithub[sessionId]?.pr ?? pr,
          linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
          fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
          loading: state.sessionGithub[sessionId]?.loading ?? false,
          error: state.sessionGithub[sessionId]?.error ?? null,
          detail: state.sessionGithub[sessionId]?.detail ?? null,
          detailFetchedAt: state.sessionGithub[sessionId]?.detailFetchedAt ?? null,
          detailLoading: false,
          detailError: opts?.silent ? null : formatError(lastErr),
        },
      },
    }))
  }
}
