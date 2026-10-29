import type { AutoOutcome } from '@goodboy/db';
import { publishTextOf, type ResultPublish } from './publish';
import type { ResultCheck, ResultChecksRun } from './result';

export const OUTCOME_MAX_CHARS = 100;

const OUTCOME_OPEN = '<<outcome>>';
const OUTCOME_CLOSE = '<</outcome>>';
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

export const parseOutcomeLine = ({ text: canonical }: TextParams): string | null => {
  let found: string | null = null;
  let from = 0;
  while (from < canonical.length) {
    const openAt = canonical.indexOf(OUTCOME_OPEN, from);
    if (openAt === -1) {
      break;
    }
    const bodyAt = openAt + OUTCOME_OPEN.length;
    const closeAt = canonical.indexOf(OUTCOME_CLOSE, bodyAt);
    if (closeAt === -1) {
      break;
    }
    const body = capOutcomeText({ text: canonical.slice(bodyAt, closeAt) });
    if (body !== '') {
      found = body;
    }
    from = closeAt + OUTCOME_CLOSE.length;
  }
  return found;
};

export const stripOutcomeLine = ({ text: canonical }: TextParams): string => {
  const parts: string[] = [];
  let from = 0;
  while (from < canonical.length) {
    const openAt = canonical.indexOf(OUTCOME_OPEN, from);
    if (openAt === -1) {
      break;
    }
    parts.push(canonical.slice(from, openAt));
    const closeAt = canonical.indexOf(OUTCOME_CLOSE, openAt + OUTCOME_OPEN.length);
    if (closeAt === -1) {
      return parts.join('').replace(BLANK_LINES_RE, '\n\n').trim();
    }
    from = closeAt + OUTCOME_CLOSE.length;
  }
  parts.push(canonical.slice(from));
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
