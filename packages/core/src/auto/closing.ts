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
const ATTR_RE = /([\w-]+)\s*=\s*"([^"]*)"/g;

type AttrsParams = {
  readonly raw: string;
};

const attrsOf = ({ raw }: AttrsParams): Readonly<Record<string, string>> => {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null = ATTR_RE.exec(raw);
  while (match !== null) {
    attrs[match[1] ?? ''] = match[2] ?? '';
    match = ATTR_RE.exec(raw);
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
