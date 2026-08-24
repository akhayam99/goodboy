import type { DiffCommentAnchor, DiffHunkLine, FileDiffStatus } from '@goodboy/types';

export type ReviewState = 'none' | 'reviewed' | 'stale';

export const LINE_PREFIX: Record<DiffHunkLine['kind'], string> = {
  add: '+',
  del: '-',
  context: ' ',
};

export const STATUS_GLYPH: Record<FileDiffStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
};

export const STATUS_COLOR: Record<FileDiffStatus, string> = {
  added: 'text-success',
  modified: 'text-info',
  deleted: 'text-danger',
  renamed: 'text-warning',
};

export const INITIAL_VISIBLE_LINES = 1000;
export const VISIBLE_LINES_STEP = 2000;

export const DIFF_SCROLL_CONTENT_CLASS = 'sticky left-0 box-border w-[var(--diff-card-width)]';

export const DIFF_CAPPED_COLUMN_CLASS = 'mx-auto w-full max-w-5xl' as const;

export const TOOLBAR_ICON_BTN =
  'rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground' as const;

export const lineAnchor = (line: DiffHunkLine): DiffCommentAnchor | null => {
  if (line.kind === 'del') {
    return line.oldLine !== null ? { side: 'old', lineNumber: line.oldLine } : null;
  }
  return line.newLine !== null ? { side: 'new', lineNumber: line.newLine } : null;
};

export const anchorKey = (a: DiffCommentAnchor): string => `${a.side}:${a.lineNumber}`;
