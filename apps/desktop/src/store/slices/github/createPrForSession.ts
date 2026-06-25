import type { SessionId } from '@goodboy/types'
import { tauriGhRunner } from '../../../features/github/github'
import type { GetFn, SetFn } from './types'

export type CreatePrOptions = {
  title?: string
  body?: string
  base?: string
  draft?: boolean
}

export const createPrForSession = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, opts?: CreatePrOptions) => {
    const branch = get().sessionBranches[sessionId]
    const session = get().sessions.find((s) => s.id === sessionId)
    if (!branch || !session) {
      throw new Error(
        'No branch is linked to this session yet, open it once so its worktree resolves.',
      )
    }
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId)
    if (!workspace) {
      throw new Error('Workspace not found for this session.')
    }

    const args = ['pr', 'create']
    const hasFields = opts?.title !== undefined || opts?.body !== undefined
    if (hasFields) {
      args.push('--title', opts?.title?.trim() || session.goal)
      args.push('--body', opts?.body ?? '')
    } else {
      args.push('--fill')
    }
    if (opts?.base?.trim()) {
      args.push('--base', opts.base.trim())
    }
    if ((opts?.draft ?? true) === true) {
      args.push('--draft')
    }

    const res = await tauriGhRunner.run(args, {
      cwd: workspace.rootPath,
      workspaceId: session.workspaceId,
    })
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr create exited with ${res.exitCode}`
      void get().emitNotification('error', 'error', 'PR creation failed', errMsg, {
        sessionId,
        workspaceId: workspace.id,
      })
      throw new Error(errMsg)
    }
    await get().refreshSessionPr(sessionId, { force: true })
    void get().emitNotification(
      'pr-created',
      'success',
      `PR created for: ${session.goal}`,
      undefined,
      { sessionId, workspaceId: workspace.id },
    )
  }
}
