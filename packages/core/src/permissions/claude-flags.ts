import type { ClaudePermissionMode, PermissionRule, SessionId, WorkspaceId } from '@goodboy/types'
import { formatToolPattern } from './matcher'
import { SCOPE_RANK, isApplicable } from './shared'

export type ClaudeFlagSet = {
  readonly allowedTools: ReadonlyArray<string>
  readonly disallowedTools: ReadonlyArray<string>
  readonly permissionMode: ClaudePermissionMode
}

export const buildClaudeFlags = (input: {
  readonly rules: ReadonlyArray<PermissionRule>
  readonly scope: { workspaceId: WorkspaceId; sessionId: SessionId }
  readonly permissionMode?: ClaudeFlagSet['permissionMode']
}): ClaudeFlagSet => {
  const applicable = input.rules.filter((r) => isApplicable(r, input.scope))

  const sorted = [...applicable].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority
    }
    return SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope]
  })

  const allowedSet = new Set<string>()
  const disallowedSet = new Set<string>()
  const allowedTools: string[] = []
  const disallowedTools: string[] = []

  for (const rule of sorted) {
    if (rule.decision === 'ask') {
      continue
    }
    const rendered = formatToolPattern(rule.pattern)
    if (rule.decision === 'allow') {
      if (!allowedSet.has(rendered)) {
        allowedSet.add(rendered)
        allowedTools.push(rendered)
      }
    } else {
      if (!disallowedSet.has(rendered)) {
        disallowedSet.add(rendered)
        disallowedTools.push(rendered)
      }
    }
  }

  return { allowedTools, disallowedTools, permissionMode: input.permissionMode ?? 'default' }
}
