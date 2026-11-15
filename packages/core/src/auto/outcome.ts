import type { AutoOutcome } from '@goodboy/db';
import { publishTextOf, type ResultPublish } from './publish';
import type { ResultCheck, ResultChecksRun } from './result';

export const OUTCOME_MAX_CHARS = 100;

const ELLIPSIS = '...';
const WHITESPACE_RE = /\s+/g;
const TRAILING_STOP_RE = /[.\s]+$/;
const BLANK_LINES_RE = /\n{3,}/g;

export type OutcomeTone = 'success' | 'danger' | 'warning' | 'neutral';

export type OutcomeLine = Readonly<{
  text: string;
  tone: OutcomeTone;
  source: 'model' | 'facts';
}>;

type TextParams = {
  readonly text: string;
};

export const capOutcomeText = ({ text }: TextParams): string => {
  const flat = text.replace(WHITESPACE_RE, ' ').trim();
  if (flat.length <= OUTCOME_MAX_CHARS) {
    return flat;
  }
  const head = flat.slice(0, OUTCOME_MAX_CHARS - ELLIPSIS.length).replace(TRAILING_STOP_RE, '');
  return `${head}${ELLIPSIS}`;
};

type OutcomeMarker = Readonly<{
  start: number;
  end: number;
  isClose: boolean;
}>;

type OutcomeBlock = Readonly<{
  start: number;
  end: number;
  body: string;
}>;

type OutcomeScan = Readonly<{
  blocks: ReadonlyArray<OutcomeBlock>;
  strays: ReadonlyArray<OutcomeMarker>;
  openTailAt: number | null;
}>;

const MARKER_NAME = 'outcome';
const MARKER_LEAD_MAX = 6;
const MARKER_TRAIL_MAX = 3;

type CharParams = {
  readonly text: string;
  readonly at: number;
};

const isMarkerWordAt = ({ text, at }: CharParams): boolean => {
  const char = text.charAt(at);
  return (
    (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '-' || char === '_'
  );
};

const markersOf = ({ text }: TextParams): ReadonlyArray<OutcomeMarker> => {
  const lower = text.toLowerCase();
  const markers: OutcomeMarker[] = [];
  let at = lower.indexOf(MARKER_NAME);
  while (at !== -1) {
    const nameEnd = at + MARKER_NAME.length;
    let start = at;
    while (
      start > 0 &&
      at - start < MARKER_LEAD_MAX &&
      (text.charAt(start - 1) === '<' || text.charAt(start - 1) === '/')
    ) {
      start -= 1;
    }
    let end = nameEnd;
    while (end < text.length && end - nameEnd < MARKER_TRAIL_MAX && text.charAt(end) === '>') {
      end += 1;
    }
    const lead = text.slice(start, at);
    const isMarker =
      lead.includes('<') &&
      (end > nameEnd || lead.includes('<<')) &&
      !isMarkerWordAt({ text, at: nameEnd }) &&
      start >= (markers.at(-1)?.end ?? 0);
    if (isMarker) {
      markers.push({ start, end, isClose: lead.includes('/') });
    }
    at = lower.indexOf(MARKER_NAME, nameEnd);
  }
  return markers;
};

const scanOutcome = ({ text }: TextParams): OutcomeScan => {
  const blocks: OutcomeBlock[] = [];
  const strays: OutcomeMarker[] = [];
  let open: OutcomeMarker | null = null;
  for (const marker of markersOf({ text })) {
    if (open === null) {
      if (marker.isClose) {
        strays.push(marker);
        continue;
      }
      open = marker;
      continue;
    }
    blocks.push({ start: open.start, end: marker.end, body: text.slice(open.end, marker.start) });
    open = null;
  }
  return { blocks, strays, openTailAt: open === null ? null : open.start };
};

export const parseOutcomeLine = ({ text }: TextParams): string | null => {
  let found: string | null = null;
  for (const block of scanOutcome({ text }).blocks) {
    const body = capOutcomeText({ text: block.body });
    if (body !== '') {
      found = body;
    }
  }
  return found;
};

export const stripOutcomeLine = ({ text }: TextParams): string => {
  const { blocks, strays, openTailAt } = scanOutcome({ text });
  const cuts = [...blocks, ...strays].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let from = 0;
  for (const cut of cuts) {
    parts.push(text.slice(from, cut.start));
    from = cut.end;
  }
  parts.push(text.slice(from, openTailAt === null ? text.length : Math.max(from, openTailAt)));
  return parts.join('').replace(BLANK_LINES_RE, '\n\n').trim();
};

export type OutcomeLineParams = Readonly<{
  modelLine: string | null;
  outcome: AutoOutcome | null;
  checksRun?: ResultChecksRun | null;
  checks?: ReadonlyArray<ResultCheck>;
  publish?: ResultPublish | null;
  failure?: string | null;
}>;

const FAILED_PUBLISH_STATES: ReadonlyArray<ResultPublish['state']> = [
  'failed',
  'declined',
  'put_back',
];

const OUTCOME_TEXT = {
  completed: 'Done',
  failed: 'Failed',
  blocked: 'Blocked',
  stopped: 'Stopped',
  timed_out: 'Timed out',
} satisfies Record<AutoOutcome, string>;

const OUTCOME_TONE = {
  completed: 'success',
  failed: 'danger',
  blocked: 'warning',
  stopped: 'neutral',
  timed_out: 'danger',
} satisfies Record<AutoOutcome, OutcomeTone>;

type FactsParams = {
  readonly text: string;
  readonly tone: OutcomeTone;
};

const factsLine = ({ text, tone }: FactsParams): OutcomeLine => ({
  text: capOutcomeText({ text }),
  tone,
  source: 'facts',
});

export const outcomeLineOf = ({
  modelLine,
  outcome,
  checksRun = null,
  checks = [],
  publish = null,
  failure = null,
}: OutcomeLineParams): OutcomeLine | null => {
  if (checksRun !== null && checksRun.verdict === 'red') {
    const redCount = checks.filter((check) => check.status === 'fail').length;
    return factsLine({ text: `Checks failed: ${Math.max(redCount, 1)}`, tone: 'danger' });
  }
  if (publish !== null && FAILED_PUBLISH_STATES.includes(publish.state)) {
    return factsLine({ text: publishTextOf({ publish }), tone: 'danger' });
  }
  const line = modelLine === null ? '' : capOutcomeText({ text: modelLine });
  if (outcome === null) {
    return line === '' ? null : { text: line, tone: 'neutral', source: 'model' };
  }
  if (line !== '') {
    return { text: line, tone: OUTCOME_TONE[outcome], source: 'model' };
  }
  const reason =
    outcome === 'completed' || failure === null ? '' : capOutcomeText({ text: failure });
  const text = reason === '' ? OUTCOME_TEXT[outcome] : `${OUTCOME_TEXT[outcome]}: ${reason}`;
  return factsLine({ text, tone: OUTCOME_TONE[outcome] });
};
