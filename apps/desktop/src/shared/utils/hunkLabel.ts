import type { DiffHunk } from '@goodboy/types';

const CONTEXT_MAX = 64;

const contextOf = (header: string): string => {
  const closing = header.lastIndexOf('@@');
  if (closing === -1) {
    return '';
  }
  const context = header.slice(closing + 2).trim();
  return context.length > CONTEXT_MAX ? `${context.slice(0, CONTEXT_MAX - 1)}…` : context;
};

const rangeOf = ({ hunk }: { readonly hunk: DiffHunk }): string => {
  if (hunk.newLines === 0) {
    const last = hunk.oldStart + Math.max(hunk.oldLines, 1) - 1;
    return hunk.oldLines <= 1
      ? `Line ${hunk.oldStart} removed`
      : `Lines ${hunk.oldStart}-${last} removed`;
  }
  const last = hunk.newStart + hunk.newLines - 1;
  return hunk.newLines === 1 ? `Line ${hunk.newStart}` : `Lines ${hunk.newStart}-${last}`;
};

export const hunkLabel = ({ hunk }: { readonly hunk: DiffHunk }): string => {
  const range = rangeOf({ hunk });
  const context = contextOf(hunk.header);
  return context === '' ? range : `${range} · in ${context}`;
};
