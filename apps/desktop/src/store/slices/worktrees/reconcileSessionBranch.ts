import type { SessionId } from '@goodboy/types'
import { listWorktreesForSession, updateSessionWorktreeBranch } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { GetFn, SetFn } from './types'

export const reconcileSessionBranch = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, observedBranch: string) => {
    const trimmed = observedBranch.trim()
    if (!trimmed) {
      return
    }
    if (get().sessionBranches[sessionId] === trimmed) {
      return
    }
    const worktrees = await listWorktreesForSession(tauriDatabase, sessionId)
    const primary = worktrees[0]
    if (!primary) {
      return
    }
    if (primary.branch !== trimmed) {
      await updateSessionWorktreeBranch(tauriDatabase, sessionId, primary.parallelIndex, trimmed)
    }
    set((state) => {
      const nextGithub = { ...state.sessionGithub }
      delete nextGithub[sessionId]
      return {
        sessionBranches: { ...state.sessionBranches, [sessionId]: trimmed },
        sessionGithub: nextGithub,
      }
    })
  }
}
