import { trimEndOf } from './trim-end-of';

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
const NEWLINE = '\n';
const DEFAULT_MARKER = '- ';

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

type DecisionLinesParams = {
  readonly marker: string;
  readonly decision: string;
};

const linesFor = ({ marker, decision }: DecisionLinesParams): ReadonlyArray<string> => {
  const [first = '', ...rest] = decision.split('\n');
  return [`${marker}${first}`, ...rest];
};

const lastRowMarker = ({ segments }: SegmentsParams): string | null => {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment?.kind === 'row') {
      return segment.marker;
    }
  }
  return null;
};

const usesBlankSeparation = ({ segments }: SegmentsParams): boolean =>
  segments.some(
    (segment, index) =>
      segment.kind === 'gap' &&
      index > 0 &&
      index < segments.length - 1 &&
      segment.lines.some((line) => BLANK_LINE.test(line)),
  );

type ReplaceParams = {
  readonly text: string;
  readonly index: number;
  readonly decision: string;
};

export const replaceDecision = ({ text, index, decision }: ReplaceParams): string => {
  if (decision.trim() === '') {
    return text;
  }
  const document = parseDecisions({ text });
  const target = document.segments[index];
  if (target == null || target.kind !== 'row') {
    return text;
  }
  const segments = document.segments.map((segment, position) =>
    position === index
      ? { ...segment, lines: linesFor({ marker: segment.marker, decision }) }
      : segment,
  );
  return serializeDecisions({ segments });
};

type RemoveParams = {
  readonly text: string;
  readonly index: number;
};

export const removeDecision = ({ text, index }: RemoveParams): string => {
  const document = parseDecisions({ text });
  const target = document.segments[index];
  if (target == null || target.kind !== 'row') {
    return text;
  }

  const dropped = new Set<number>([index]);
  const next = document.segments[index + 1];
  const previous = document.segments[index - 1];
  if (next?.kind === 'gap') {
    dropped.add(index + 1);
  }
  if (next?.kind !== 'gap' && previous?.kind === 'gap') {
    dropped.add(index - 1);
  }

  const segments = document.segments.filter((_, position) => dropped.has(position) === false);
  return serializeDecisions({ segments });
};

type AppendParams = {
  readonly text: string;
  readonly decision: string;
};

export const appendDecision = ({ text, decision }: AppendParams): string => {
  if (decision.trim() === '') {
    return text;
  }
  const document = parseDecisions({ text });
  const marker = lastRowMarker({ segments: document.segments }) ?? DEFAULT_MARKER;
  const lines = linesFor({ marker, decision });
  if (text.trim() === '') {
    return lines.join('\n');
  }
  const separator = usesBlankSeparation({ segments: document.segments }) ? '\n\n' : '\n';
  return `${trimEndOf({ text, characters: NEWLINE })}${separator}${lines.join('\n')}`;
};
