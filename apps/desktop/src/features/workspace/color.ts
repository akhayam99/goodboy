import type { WorkspaceId } from '@goodboy/types';

export const WORKSPACE_ACCENTS = [
  'var(--color-identity-1)',
  'var(--color-identity-2)',
  'var(--color-identity-3)',
  'var(--color-identity-4)',
  'var(--color-identity-5)',
  'var(--color-identity-6)',
  'var(--color-identity-7)',
  'var(--color-identity-8)',
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
