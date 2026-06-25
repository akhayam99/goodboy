import { useEffect, useState } from 'react'
import type { SessionId } from '@goodboy/types'
import { useAppStore, useSessions } from '../../store'
import { worktreeList } from './worktree'

export type BranchConflict =
  | { readonly kind: 'session'; readonly sessionId: SessionId }
  | { readonly kind: 'worktree'; readonly path: string }
  | null

export const useBranchConflict = (
  branch: string | null,
  repoPath: string | null,
): BranchConflict => {
  const sessions = useSessions()
  const sessionBranches = useAppStore((s) => s.sessionBranches)
  const [worktreePath, setWorktreePath] = useState<string | null>(null)

  const sessionId = branch
    ? (sessions.find((s) => sessionBranches[s.id] === branch)?.id ?? null)
    : null

  useEffect(() => {
    setWorktreePath(null)
    if (!branch || !repoPath || sessionId) {
      return
    }
    let cancelled = false
    worktreeList(repoPath)
      .then((list) => {
        if (!cancelled) {
          setWorktreePath(list.find((w) => w.branch === branch && !w.isMain)?.path ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorktreePath(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [branch, repoPath, sessionId])

  if (sessionId) {
    return { kind: 'session', sessionId }
  }
  if (worktreePath) {
    return { kind: 'worktree', path: worktreePath }
  }
  return null
}
