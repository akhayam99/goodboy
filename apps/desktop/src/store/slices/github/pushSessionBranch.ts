import type { SessionId } from '@goodboy/types'
import { gitPush } from '../../../features/github/github'
import type { GetFn } from './types'

type PushResult = { ok: true } | { ok: false; error: string }

export const pushSessionBranch = async (get: GetFn, sessionId: SessionId): Promise<PushResult> => {
  const session = get().sessions.find((s) => s.id === sessionId)
  if (!session) {
    return { ok: false, error: 'session not found' }
  }
  const workspace = get().workspaces.find((w) => w.id === session.workspaceId)
  const cwd = get().sessionWorktrees[sessionId]?.[0] ?? workspace?.rootPath
  if (!cwd) {
    return { ok: false, error: 'no worktree resolved for this session to push from' }
  }
  const push = await gitPush(cwd, get().sessionBranches[sessionId] ?? null, session.workspaceId)
  if (push.exitCode !== 0) {
    return { ok: false, error: push.stderr.trim() || `git push exited with ${push.exitCode}` }
  }
  return { ok: true }
}
