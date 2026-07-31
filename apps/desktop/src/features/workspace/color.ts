import type { WorkspaceId } from '@goodboy/types';

export const WORKSPACE_ACCENTS = [
  'var(--color-workspace-1)',
  'var(--color-workspace-2)',
  'var(--color-workspace-3)',
  'var(--color-workspace-4)',
  'var(--color-workspace-5)',
  'var(--color-workspace-6)',
  'var(--color-workspace-7)',
  'var(--color-workspace-8)',
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export const workspaceAccent = (id: WorkspaceId): string => {
  return WORKSPACE_ACCENTS[hashId(id) % WORKSPACE_ACCENTS.length] ?? WORKSPACE_ACCENTS[0];
};
