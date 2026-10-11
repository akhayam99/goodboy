import type { DiffHunk, DiffHunkLine } from '@goodboy/types';
import type { FileSides } from '../../worktree/worktree';

export type ContextExpansion = {
  readonly above: number;
  readonly below: number;
  readonly isAll: boolean;
};

export type ContextGap = {
  readonly type: 'gap';
  readonly index: number;
  readonly oldStart: number;
  readonly newStart: number;
  readonly count: number | null;
  readonly revealCount: number;
  readonly before: ReadonlyArray<DiffHunkLine>;
  readonly after: ReadonlyArray<DiffHunkLine>;
};

type Params = {
  readonly hunks: ReadonlyArray<DiffHunk>;
  readonly sides: FileSides | null;
  readonly expansions: ReadonlyMap<number, ContextExpansion>;
};

type LinesParams = { readonly text: string | null };

const fileLines = ({ text }: LinesParams): ReadonlyArray<string> => {
  if (text === null || text === '') {
    return [];
  }
  const lines = text.split('\n');
  if (text.endsWith('\n')) {
    lines.pop();
  }
  return lines;
};

export const contextGaps = ({ hunks, sides, expansions }: Params): ReadonlyArray<ContextGap> => {
  const oldLines = fileLines({ text: sides?.old ?? null });
  const newLines = fileLines({ text: sides?.new ?? null });
  const gaps: ContextGap[] = [];
  let oldStart = 1;
  let newStart = 1;
  for (let index = 0; index <= hunks.length; index += 1) {
    const next = hunks[index];
    const oldEnd =
      next === undefined
        ? oldLines.length + 1
        : Math.min(
            sides === null || sides.isTooLarge ? Infinity : oldLines.length + 1,
            Math.max(1, next.oldStart),
          );
    const newEnd =
      next === undefined
        ? newLines.length + 1
        : Math.min(
            sides === null || sides.isTooLarge ? Infinity : newLines.length + 1,
            Math.max(1, next.newStart),
          );
    const isUnknownTail = next === undefined && (sides === null || sides.isTooLarge);
    const count = isUnknownTail
      ? null
      : Math.max(0, Math.max(oldEnd - oldStart, newEnd - newStart));
    const expansion = expansions.get(index);
    const below = Math.min(count ?? 0, Math.max(0, expansion?.below ?? 0));
    const above =
      expansion?.isAll === true
        ? (count ?? 0) - below
        : Math.min((count ?? 0) - below, Math.max(0, expansion?.above ?? 0));
    const lines: DiffHunkLine[] = [];
    if (sides !== null && !sides.isTooLarge) {
      for (let offset = 0; offset < (count ?? 0); offset += 1) {
        if (offset >= below && offset < (count ?? 0) - above) {
          continue;
        }
        const newText = newLines[newStart + offset - 1];
        const oldText = oldLines[oldStart + offset - 1];
        lines.push({
          kind: 'context',
          oldLine: oldText === undefined ? null : oldStart + offset,
          newLine: newText === undefined ? null : newStart + offset,
          text: newText ?? oldText ?? '',
        });
      }
    }
    gaps.push({
      type: 'gap',
      index,
      oldStart: oldStart + below,
      newStart: newStart + below,
      count: count === null ? null : count - above - below,
      revealCount: Math.min(20, count === null ? 20 : count - above - below),
      before: lines.slice(0, below),
      after: lines.slice(below),
    });
    if (next !== undefined) {
      oldStart = next.oldStart + next.oldLines;
      newStart = next.newStart + next.newLines;
      if (next.oldLines === 0) {
        oldStart += 1;
      }
      if (next.newLines === 0) {
        newStart += 1;
      }
    }
  }
  return gaps;
};
