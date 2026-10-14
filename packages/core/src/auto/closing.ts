import { extractMarkers, stripControlMarkers } from '../context/marker-parsing';

export type ChildCompletion = 'done' | 'blocked' | 'none';

export type ChildQuestion = Readonly<{
  text: string;
  suggestedAnswers: ReadonlyArray<string>;
  recommendedAnswer: string | null;
}>;

export type ChildClosing = Readonly<{
  completion: ChildCompletion;
  question: ChildQuestion | null;
  summary: string;
}>;

const STEP_DONE_RE = /<<step-done\s([^<>]*)>>/g;
const NAME_CHAR_RE = /[\w-]/;
const SPACE_CHAR_RE = /\s/;

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
    if (raw.charAt(quoteAt) !== '"') {
      index = nameEnd;
      continue;
    }
    const closeAt = raw.indexOf('"', quoteAt + 1);
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

const completionOf = ({ text, childAgentId }: CompletionParams): ChildCompletion => {
  STEP_DONE_RE.lastIndex = 0;
  let completion: ChildCompletion = 'none';
  let match: RegExpExecArray | null = STEP_DONE_RE.exec(text);
  while (match !== null) {
    const attrs = attrsOf({ raw: match[1] ?? '' });
    if ((attrs['id'] ?? '').trim() === childAgentId) {
      completion = (attrs['status'] ?? '').trim() === 'blocked' ? 'blocked' : 'done';
    }
    match = STEP_DONE_RE.exec(text);
  }
  return completion;
};

const SUMMARY_CHARS = 2_000;

export const parseChildClosing = ({ text, childAgentId }: CompletionParams): ChildClosing => {
  const blocking = extractMarkers(text).questions.find((candidate) => candidate.isBlocking);
  return {
    completion: completionOf({ text, childAgentId }),
    question:
      blocking === undefined
        ? null
        : {
            text: blocking.text,
            suggestedAnswers: blocking.suggestedAnswers,
            recommendedAnswer: blocking.recommendedAnswer,
          },
    summary: stripControlMarkers(text).slice(-SUMMARY_CHARS),
  };
};
