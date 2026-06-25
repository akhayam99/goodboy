import type { WorkspaceId } from '@goodboy/types'

export const WORKSPACE_ACCENTS = [
  '#5ec8c0',
  '#6aa8ff',
  '#a98bff',
  '#ef8fb3',
  '#e0a45e',
  '#7bc96f',
  '#e57373',
  '#4fb6e0',
] as const

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export const workspaceAccent = (id: WorkspaceId): string => {
  return WORKSPACE_ACCENTS[hashId(id) % WORKSPACE_ACCENTS.length] ?? WORKSPACE_ACCENTS[0]
}
