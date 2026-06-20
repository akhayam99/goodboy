import type { ContextSlot } from '@goodboy/types';

export type SummarizerStatusKind = 'idle' | 'running' | 'error';

export interface FilesTouchedShape {
  readonly paths: ReadonlyArray<string>;
  readonly count: number;
  readonly additions: number;
  readonly deletions: number;
}

export function normalizeFilesSlot(slot: ContextSlot, workingDir: string | null): ContextSlot {
  if (!workingDir || slot.value.length === 0) return slot;
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  const normalized = slot.value
    .split('\n')
    .map((p) => (p.startsWith(root) ? p.slice(root.length) : p))
    .join('\n');
  return normalized === slot.value ? slot : { ...slot, value: normalized };
}
