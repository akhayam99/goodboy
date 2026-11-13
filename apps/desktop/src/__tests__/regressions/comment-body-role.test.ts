// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { PANE_RHYTHM } from '@goodboy/ui';

const SRC = join(__dirname, '..', '..');

const SURFACES = [
  'features/diff/components/DiffView/CommentThread.tsx',
  'features/resolve/components/ReviewFlow/ReviewComment.tsx',
  'features/resolve/components/ReviewFlow/ReplyNote.tsx',
  'features/review/components/WriteReview/LineComment.tsx',
  'shared/components/ThreadReplies/FullReplies.tsx',
] as const;

const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

describe('one comment body role on every surface', () => {
  it.each(SURFACES)('%s draws a comment through CommentBody', (path) => {
    const text = read(path);
    expect(text).toContain('CommentBody');
    expect(text).not.toMatch(/<Markdown[^>]*variant="preview"/);
  });

  it('sets the one role at 14/22 on CommentBody and nowhere else', () => {
    const body = read('shared/components/CommentBody/index.tsx');
    expect(body).toContain('text-comment');
    expect(body).not.toMatch(/text-prose|text-body/);
    const css = read('styles.css');
    expect(css).toMatch(/--text-comment:\s*14px;/);
    expect(css).toMatch(/--text-comment--line-height:\s*22px;/);
  });
});

describe('the review pane header', () => {
  it('is 40: an 8 inset over a 32 row', () => {
    expect(PANE_RHYTHM.headerInset).toBe('pt-2');
    expect(PANE_RHYTHM.headerRow).toBe('h-8');
  });
});
