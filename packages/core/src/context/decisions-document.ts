type DecisionSegment = {
  readonly kind: 'row' | 'gap';
  readonly lines: ReadonlyArray<string>;
  readonly marker: string;
};

export type DecisionRow = {
  readonly index: number;
  readonly text: string;
};

export type DecisionsDocument = {
  readonly segments: ReadonlyArray<DecisionSegment>;
  readonly rows: ReadonlyArray<DecisionRow>;
  readonly hasContentOutsideRows: boolean;
};

const BLANK_LINE = /^[ \t]*$/;
const ROW_START = /^\S/;
const BULLET_MARKER = /^(?:[-*+]|\d+[.)])[ \t]+/;
const FENCE_LINE = /^ {0,3}(?:```|~~~)/;

type MutableSegment = {
  kind: 'row' | 'gap';
  lines: string[];
  marker: string;
};

type SegmentParams = {
  readonly segment: DecisionSegment;
};

const textOf = ({ segment }: SegmentParams): string => {
  const [first = '', ...rest] = segment.lines;
  return [first.slice(segment.marker.length), ...rest].join('\n');
};

type TextParams = {
  readonly text: string;
};

export const parseDecisions = ({ text }: TextParams): DecisionsDocument => {
  if (text === '') {
    return { segments: [], rows: [], hasContentOutsideRows: false };
  }

  const segments: MutableSegment[] = [];
  let isFenced = false;
  let openRow: MutableSegment | null = null;

  const appendGap = (line: string) => {
    openRow = null;
    const tail = segments.at(-1);
    if (tail != null && tail.kind === 'gap') {
      tail.lines.push(line);
      return;
    }
    segments.push({ kind: 'gap', lines: [line], marker: '' });
  };

  for (const line of text.split('\n')) {
    const isFenceToggle = FENCE_LINE.test(line);
    const isInsideFence = isFenced || isFenceToggle;
    if (isFenceToggle) {
      isFenced = !isFenced;
    }

    if (!isInsideFence && BLANK_LINE.test(line)) {
      appendGap(line);
      continue;
    }
    if (!isInsideFence && ROW_START.test(line)) {
      const row: MutableSegment = {
        kind: 'row',
        lines: [line],
        marker: BULLET_MARKER.exec(line)?.[0] ?? '',
      };
      segments.push(row);
      openRow = row;
      continue;
    }
    if (openRow != null) {
      openRow.lines.push(line);
      continue;
    }
    appendGap(line);
  }

  const rows = segments.flatMap((segment, index) =>
    segment.kind === 'row' ? [{ index, text: textOf({ segment }) }] : [],
  );

  const hasContentOutsideRows = segments.some(
    (segment) =>
      segment.kind === 'gap' && segment.lines.some((line) => BLANK_LINE.test(line) === false),
  );

  return { segments, rows, hasContentOutsideRows };
};

type SegmentsParams = {
  readonly segments: DecisionsDocument['segments'];
};

export const serializeDecisions = ({ segments }: SegmentsParams): string =>
  segments.flatMap((segment) => [...segment.lines]).join('\n');
