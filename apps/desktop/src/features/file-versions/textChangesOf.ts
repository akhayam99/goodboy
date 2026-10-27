import { wordDiff, type WordSegment } from '../resolve/wordSegments';
import { lineDiff, type LineEdit } from './lineDiff';

export type TextChangeLine = Readonly<{
  kind: LineEdit['kind'];
  lineNumber: number;
  segments: ReadonlyArray<WordSegment>;
}>;

type TextChangeRow =
  | Readonly<{ kind: 'line'; line: TextChangeLine }>
  | Readonly<{ kind: 'gap'; id: string; lines: ReadonlyArray<TextChangeLine> }>
  | Readonly<{ kind: 'more'; count: number }>;

export type TextChanges = Readonly<{
  rows: ReadonlyArray<TextChangeRow>;
  additions: number;
  deletions: number;
}>;

type Params = Readonly<{
  before: string | null;
  after: string | null;
}>;

type TextParams = Readonly<{ text: string | null }>;

type PairParams = Readonly<{
  edits: ReadonlyArray<LineEdit>;
  before: ReadonlyArray<string>;
  after: ReadonlyArray<string>;
}>;

type MarkParams = Readonly<{ from: string; to: string }>;

type ShareParams = Readonly<{ segments: ReadonlyArray<WordSegment> }>;

type LineParams = Readonly<{
  edit: LineEdit;
  before: ReadonlyArray<string>;
  after: ReadonlyArray<string>;
  marks: ReadonlyMap<LineEdit, ReadonlyArray<WordSegment>>;
}>;

type VisibleParams = Readonly<{ edits: ReadonlyArray<LineEdit> }>;

const CONTEXT_LINES = 3;
const MAX_SHOWN_LINES = 800;
const MAX_MARKED_CHARS = 1_000;
const MAX_CHANGED_SHARE = 0.8;
const MIN_GAP_LINES = 3;

const linesOf = ({ text }: TextParams): ReadonlyArray<string> => {
  if (text === null || text === '') {
    return [];
  }
  const lines = text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines;
};

const changedShareOf = ({ segments }: ShareParams): number => {
  const total = segments.reduce((sum, segment) => sum + segment.text.length, 0);
  const changed = segments
    .filter((segment) => segment.isChanged)
    .reduce((sum, segment) => sum + segment.text.length, 0);
  return total === 0 ? 0 : changed / total;
};

const marksOf = ({ from, to }: MarkParams): ReturnType<typeof wordDiff> | null => {
  if (from.length > MAX_MARKED_CHARS || to.length > MAX_MARKED_CHARS) {
    return null;
  }
  const marks = wordDiff({ before: from, after: to });
  const isTooChanged =
    changedShareOf({ segments: marks.before }) > MAX_CHANGED_SHARE ||
    changedShareOf({ segments: marks.after }) > MAX_CHANGED_SHARE;
  return isTooChanged ? null : marks;
};

const pairedMarks = ({
  edits,
  before,
  after,
}: PairParams): ReadonlyMap<LineEdit, ReadonlyArray<WordSegment>> => {
  const marks = new Map<LineEdit, ReadonlyArray<WordSegment>>();
  let index = 0;
  while (index < edits.length) {
    const removed: Array<LineEdit> = [];
    while (edits[index]?.kind === 'del') {
      removed.push(edits[index]!);
      index += 1;
    }
    const added: Array<LineEdit> = [];
    while (edits[index]?.kind === 'add') {
      added.push(edits[index]!);
      index += 1;
    }
    if (removed.length === 0 && added.length === 0) {
      index += 1;
      continue;
    }
    for (let pair = 0; pair < Math.min(removed.length, added.length); pair += 1) {
      const from = removed[pair]!;
      const to = added[pair]!;
      const found = marksOf({
        from: before[from.oldIndex ?? 0] ?? '',
        to: after[to.newIndex ?? 0] ?? '',
      });
      if (found === null) {
        continue;
      }
      marks.set(from, found.before);
      marks.set(to, found.after);
    }
  }
  return marks;
};

const lineOf = ({ edit, before, after, marks }: LineParams): TextChangeLine => {
  const isRemoved = edit.kind === 'del';
  const text = isRemoved ? (before[edit.oldIndex ?? 0] ?? '') : (after[edit.newIndex ?? 0] ?? '');
  return {
    kind: edit.kind,
    lineNumber: (isRemoved ? (edit.oldIndex ?? 0) : (edit.newIndex ?? 0)) + 1,
    segments: marks.get(edit) ?? [{ text, isChanged: false }],
  };
};

const visibleOf = ({ edits }: VisibleParams): ReadonlyArray<boolean> => {
  const visible = edits.map(() => false);
  edits.forEach((edit, index) => {
    if (edit.kind === 'same') {
      return;
    }
    const from = Math.max(0, index - CONTEXT_LINES);
    const to = Math.min(edits.length - 1, index + CONTEXT_LINES);
    for (let near = from; near <= to; near += 1) {
      visible[near] = true;
    }
  });
  return visible;
};

export const textChangesOf = ({ before, after }: Params): TextChanges => {
  const oldLines = linesOf({ text: before });
  const newLines = linesOf({ text: after });
  const edits = lineDiff({ before: oldLines, after: newLines });
  const marks = pairedMarks({ edits, before: oldLines, after: newLines });
  const visible = visibleOf({ edits });
  const rows: Array<TextChangeRow> = [];
  let hidden: Array<TextChangeLine> = [];
  let shown = 0;
  let rest = 0;
  const flush = () => {
    if (hidden.length === 0) {
      return;
    }
    if (hidden.length < MIN_GAP_LINES) {
      rows.push(...hidden.map((line): TextChangeRow => ({ kind: 'line', line })));
      hidden = [];
      return;
    }
    rows.push({ kind: 'gap', id: `gap-${rows.length}`, lines: hidden });
    hidden = [];
  };
  edits.forEach((edit, index) => {
    const line = lineOf({ edit, before: oldLines, after: newLines, marks });
    if (visible[index] !== true) {
      hidden.push(line);
      return;
    }
    if (shown >= MAX_SHOWN_LINES) {
      rest += 1;
      return;
    }
    flush();
    rows.push({ kind: 'line', line });
    shown += 1;
  });
  if (rest > 0) {
    rows.push({ kind: 'more', count: rest });
  }
  if (rest === 0 && shown > 0) {
    flush();
  }
  return {
    rows,
    additions: edits.filter((edit) => edit.kind === 'add').length,
    deletions: edits.filter((edit) => edit.kind === 'del').length,
  };
};
