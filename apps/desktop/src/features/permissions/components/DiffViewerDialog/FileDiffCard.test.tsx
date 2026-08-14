// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DiffLayoutMode } from '@goodboy/ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DiffComment, DiffHunkLine, FileDiff, IsoDateTime, SessionId } from '@goodboy/types';
import { FileDiffCard } from './FileDiffCard';

const SID = 's1' as SessionId;

const fileOf = (lines: ReadonlyArray<DiffHunkLine>, path = 'src/a.ts'): FileDiff => ({
  path,
  status: 'modified',
  additions: lines.filter((line) => line.kind === 'add').length,
  deletions: lines.filter((line) => line.kind === 'del').length,
  binary: false,
  hunks: [
    {
      header: '@@ -1,2 +1,2 @@',
      oldStart: 1,
      oldLines: lines.length,
      newStart: 1,
      newLines: lines.length,
      lines,
    },
  ],
});

const del = (oldLine: number, text: string): DiffHunkLine => ({
  kind: 'del',
  oldLine,
  newLine: null,
  text,
});

const add = (newLine: number, text: string): DiffHunkLine => ({
  kind: 'add',
  oldLine: null,
  newLine,
  text,
});

const context = (oldLine: number, newLine: number, text: string): DiffHunkLine => ({
  kind: 'context',
  oldLine,
  newLine,
  text,
});

type RenderParams = {
  file: FileDiff;
  layoutMode: DiffLayoutMode;
  comments?: ReadonlyArray<DiffComment>;
  onAddComment?: (anchor: { side: 'old' | 'new'; lineNumber: number }, body: string) => void;
};

const renderCard = ({ file, layoutMode, comments = [], onAddComment = vi.fn() }: RenderParams) =>
  render(
    <FileDiffCard
      file={file}
      layoutMode={layoutMode}
      registerRef={vi.fn()}
      reviewState="none"
      onToggleReviewed={vi.fn()}
      canOpenEditor={false}
      onOpenInEditor={vi.fn()}
      comments={comments}
      canComment
      onAddComment={onAddComment}
      onAddFileLevelComment={vi.fn()}
      onResolve={vi.fn()}
      onReopen={vi.fn()}
      onDelete={vi.fn()}
      onViewAgent={vi.fn()}
      getAgentName={() => undefined}
    />,
  );

const cellsOf = (text: string): ReadonlyArray<string> =>
  Array.from(screen.getByText(text).closest('tr')?.querySelectorAll('td') ?? []).map(
    (cell) => cell.textContent ?? '',
  );

afterEach(cleanup);

describe('FileDiffCard unified layout', () => {
  it('keeps both sides of a change on one row', () => {
    renderCard({ file: fileOf([del(1, 'gone'), add(1, 'fresh')]), layoutMode: 'unified' });
    expect(screen.getByText('gone').closest('tr')).not.toBe(
      screen.getByText('fresh').closest('tr'),
    );
    expect(cellsOf('gone')).toHaveLength(3);
  });
});

describe('FileDiffCard split layout', () => {
  it('pairs a removal with the addition that replaced it on one row', () => {
    renderCard({ file: fileOf([del(1, 'gone'), add(1, 'fresh')]), layoutMode: 'split' });
    const row = screen.getByText('gone').closest('tr');
    expect(row).toBe(screen.getByText('fresh').closest('tr'));
    expect(cellsOf('gone')).toEqual(['1', '-gone', '1', '+fresh']);
  });

  it('anchors each side to the cell that renders it', () => {
    renderCard({ file: fileOf([context(10, 20, 'shared')]), layoutMode: 'split' });
    const cells = Array.from(
      screen.getAllByText('shared')[0]?.closest('tr')?.querySelectorAll('td') ?? [],
    );
    expect(cells[0]?.getAttribute('aria-label')).toBe('comment on old line 10');
    expect(cells[2]?.getAttribute('aria-label')).toBe('comment on new line 20');
  });

  it('leaves the padded side empty and not commentable for a pure addition', () => {
    renderCard({ file: fileOf([add(1, 'first'), add(2, 'second')]), layoutMode: 'split' });
    expect(cellsOf('first')).toEqual(['', '', '1', '+first']);
    expect(screen.queryByLabelText(/comment on old line/)).toBeNull();
    expect(screen.getByLabelText('comment on new line 1')).toBeDefined();
  });

  it('leaves the new side empty for a pure deletion', () => {
    renderCard({ file: fileOf([del(1, 'first')]), layoutMode: 'split' });
    expect(cellsOf('first')).toEqual(['1', '-first', '', '']);
    expect(screen.queryByLabelText(/comment on new line/)).toBeNull();
  });

  it('renders an existing comment as a full width row under its pair', () => {
    const comment: DiffComment = {
      id: 'c1',
      sessionId: SID,
      filePath: 'src/a.ts',
      body: 'left note',
      status: 'open',
      createdAt: '2026-06-13T00:00:00.000Z' as IsoDateTime,
      anchor: { side: 'old', lineNumber: 1 },
    };
    renderCard({
      file: fileOf([del(1, 'gone'), add(1, 'fresh')]),
      layoutMode: 'split',
      comments: [comment],
    });
    const cell = screen.getByText('left note').closest('td');
    expect(cell?.getAttribute('colspan')).toBe('4');
  });

  it('confines a drag selection to the side it started on', () => {
    const onAddComment = vi.fn();
    renderCard({
      file: fileOf([del(1, 'gone a'), del(2, 'gone b'), add(1, 'fresh')]),
      layoutMode: 'split',
      onAddComment,
    });
    fireEvent.pointerDown(screen.getByLabelText('comment on old line 1'));
    const secondRow = screen.getByText('gone b').closest('tr');
    fireEvent.mouseEnter(secondRow as HTMLElement);
    fireEvent.pointerUp(window);

    expect(screen.getByText('commenting on lines 1–2')).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText(/note for the agent/i), {
      target: { value: 'range note' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(onAddComment).toHaveBeenCalledWith(
      { side: 'old', lineNumber: 1, endLineNumber: 2 },
      'range note',
    );
  });

  it('still truncates a long file behind the show more bar', () => {
    const lines = Array.from({ length: 1001 }, (_, index) => add(index + 1, `line-${index + 1}`));
    renderCard({ file: fileOf(lines), layoutMode: 'split' });
    const showMore = screen.getByRole('button', { name: /show 1 more lines/i });
    expect(showMore.closest('td')?.getAttribute('colspan')).toBe('4');
    expect(screen.queryByText('+line-1001')).toBeNull();
  });

  it('shows the binary placeholder instead of a table', () => {
    renderCard({
      file: { ...fileOf([]), binary: true, hunks: [] },
      layoutMode: 'split',
    });
    expect(screen.getByText('Binary file, no diff')).toBeDefined();
  });
});
