import { canonicalizeMarkers } from '../context/canonicalizeMarkers';
import { extractMarkers, stripControlMarkers } from '../context/marker-parsing';
import { excerptStepOutput } from '../summarizer/step-output';
import { oneLine } from './oneLine';
import { parseAutoDelegationRole, type AutoDelegationRole } from './roles';
import { parseSubstepNeeds, type AutoSubstepRole } from './substep';

export type ChildCompletion = 'done' | 'blocked' | 'none';

export type ChildNeeds =
  | Readonly<{ kind: 'shell' | 'writer' | 'decision' | 'user' }>
  | Readonly<{ kind: 'role'; role: AutoDelegationRole }>;

export type ChildReturn = Readonly<{
  needs: ChildNeeds | null;
  request: string | null;
}>;

export type ChildQuestion = Readonly<{
  text: string;
  suggestedAnswers: ReadonlyArray<string>;
  recommendedAnswer: string | null;
  needs?: AutoSubstepRole;
}>;

export type ChildClosing = Readonly<{
  completion: ChildCompletion;
  question: ChildQuestion | null;
  returned: ChildReturn | null;
  isLegacyBlock: boolean;
  summary: string;
}>;

const CHILD_REQUEST_MAX_CHARS = 300;

const STEP_DONE_RE = /<<step-done\s([^<>]*)>>/g;
const NAME_CHAR_RE = /[\w-]/;
const SPACE_CHAR_RE = /\s/;
const WHITESPACE_RE = /\s+/g;
const LEGACY_BLOCK_STATUS = 'blocked';
const RETURN_STATUSES: ReadonlySet<string> = new Set(['returned', LEGACY_BLOCK_STATUS]);
const PLAIN_NEEDS = ['shell', 'writer', 'decision', 'user'] as const;
const ROLE_NEEDS_PREFIX = 'role:';
const ARTIFACT_OPEN = '<<artifact';
const ARTIFACT_CLOSE = '<</artifact>>';
const FENCE_PREFIXES = ['```', '~~~'] as const;

type ScanParams = {
  readonly raw: string;
  readonly from: number;
};

const skipSpaces = ({ raw, from }: ScanParams): number => {
  let index = from;
  while (index < raw.length && SPACE_CHAR_RE.test(raw.charAt(index))) {
    index += 1;
  }
  return index;
};

const skipName = ({ raw, from }: ScanParams): number => {
  let index = from;
  while (index < raw.length && NAME_CHAR_RE.test(raw.charAt(index))) {
    index += 1;
  }
  return index;
};

type AttrsParams = {
  readonly raw: string;
};

const attrsOf = ({ raw }: AttrsParams): Readonly<Record<string, string>> => {
  const attrs: Record<string, string> = {};
  let index = 0;
  while (index < raw.length) {
    const nameEnd = skipName({ raw, from: index });
    if (nameEnd === index) {
      index += 1;
      continue;
    }
    const equalsAt = skipSpaces({ raw, from: nameEnd });
    if (raw.charAt(equalsAt) !== '=') {
      index = nameEnd;
      continue;
    }
    const quoteAt = skipSpaces({ raw, from: equalsAt + 1 });
    const quote = raw.charAt(quoteAt);
    if (quote !== '"' && quote !== "'") {
      let bareEnd = quoteAt;
      while (bareEnd < raw.length && !SPACE_CHAR_RE.test(raw.charAt(bareEnd))) {
        bareEnd += 1;
      }
      if (bareEnd > quoteAt) {
        attrs[raw.slice(index, nameEnd)] = raw.slice(quoteAt, bareEnd);
      }
      index = Math.max(bareEnd, nameEnd);
      continue;
    }
    const closeAt = raw.indexOf(quote, quoteAt + 1);
    if (closeAt === -1) {
      return attrs;
    }
    attrs[raw.slice(index, nameEnd)] = raw.slice(quoteAt + 1, closeAt);
    index = closeAt + 1;
  }
  return attrs;
};

type CompletionParams = {
  readonly text: string;
  readonly childAgentId: string;
};

type NeedsParams = {
  readonly value: string | undefined;
};

const needsOf = ({ value }: NeedsParams): ChildNeeds | null => {
  const needs = (value ?? '').trim();
  if (needs === '') {
    return null;
  }
  const plain = PLAIN_NEEDS.find((candidate) => candidate === needs);
  if (plain !== undefined) {
    return { kind: plain };
  }
  const role = needs.startsWith(ROLE_NEEDS_PREFIX)
    ? parseAutoDelegationRole({ role: needs.slice(ROLE_NEEDS_PREFIX.length).trim() })
    : null;
  return role === null ? { kind: 'user' } : { kind: 'role', role };
};

type LinesParams = {
  readonly lines: ReadonlyArray<string>;
};

type SliceParams = {
  readonly text: string;
};

const proseLinesOf = ({ text }: SliceParams): ReadonlyArray<string> => {
  const lines: string[] = [];
  let isInBlock = false;
  for (const line of stripControlMarkers(text).split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith(ARTIFACT_OPEN)) {
      isInBlock = true;
      continue;
    }
    if (trimmed === ARTIFACT_CLOSE) {
      isInBlock = false;
      continue;
    }
    if (!isInBlock && !FENCE_PREFIXES.some((fence) => trimmed.startsWith(fence))) {
      lines.push(line);
    }
  }
  return lines;
};

const firstRequestLineOf = ({ lines }: LinesParams): string | null => {
  for (const line of lines) {
    const request = oneLine({ text: line, max: CHILD_REQUEST_MAX_CHARS });
    if (request !== '') {
      return request;
    }
  }
  return null;
};

type Ending = Readonly<{
  completion: ChildCompletion;
  returned: ChildReturn | null;
  isLegacyBlock: boolean;
}>;

const NO_ENDING: Ending = { completion: 'none', returned: null, isLegacyBlock: false };

type FoundClosing = Readonly<{
  attrs: Readonly<Record<string, string>>;
  start: number;
  end: number;
}>;

const firstClosingOf = ({ text, childAgentId }: CompletionParams): FoundClosing | null => {
  STEP_DONE_RE.lastIndex = 0;
  let match: RegExpExecArray | null = STEP_DONE_RE.exec(text);
  while (match !== null) {
    const attrs = attrsOf({ raw: match[1] ?? '' });
    if ((attrs['id'] ?? '').replace(WHITESPACE_RE, '') === childAgentId) {
      return { attrs, start: match.index, end: match.index + match[0].length };
    }
    match = STEP_DONE_RE.exec(text);
  }
  return null;
};

const endingOf = ({ text: rawText, childAgentId }: CompletionParams): Ending => {
  const text = canonicalizeMarkers({ text: rawText });
  const first = firstClosingOf({ text, childAgentId });
  if (first === null) {
    return NO_ENDING;
  }
  const status = (first.attrs['status'] ?? '').trim();
  if (!RETURN_STATUSES.has(status)) {
    return { completion: 'done', returned: null, isLegacyBlock: false };
  }
  return {
    completion: 'blocked',
    isLegacyBlock: status === LEGACY_BLOCK_STATUS,
    returned: {
      needs: needsOf({ value: first.attrs['needs'] }),
      request:
        firstRequestLineOf({ lines: proseLinesOf({ text: text.slice(first.end) }) }) ??
        firstRequestLineOf({
          lines: [...proseLinesOf({ text: text.slice(0, first.start) })].reverse(),
        }),
    },
  };
};

export const parseChildClosing = ({ text, childAgentId }: CompletionParams): ChildClosing => {
  const ending = endingOf({ text, childAgentId });
  const blocking =
    ending.returned === null
      ? extractMarkers(text).questions.find((candidate) => candidate.isBlocking)
      : undefined;
  const needs = parseSubstepNeeds({ role: blocking?.needs });
  return {
    completion: ending.completion,
    question:
      blocking === undefined
        ? null
        : {
            text: blocking.text,
            suggestedAnswers: blocking.suggestedAnswers,
            recommendedAnswer: blocking.recommendedAnswer,
            ...(needs === null ? {} : { needs }),
          },
    returned: ending.returned,
    isLegacyBlock: ending.isLegacyBlock,
    summary: excerptStepOutput({ output: stripControlMarkers(text) }),
  };
};
