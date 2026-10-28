export type ChecksSkipped = {
  readonly reason: string;
};

const CHECK_WORD =
  /\b(?:eslint|tsc|typecheck|type-check|type check|lint|linter|linting|tests?|vitest|jest|knip|prettier|clippy|cargo|checks?|builds?|compiler)\b/i;

const NOT_RUN =
  /\b(?:did(?:n't| not)|could(?:n't| not)|can(?:'t|not)|was(?:n't| not)|were(?:n't| not)|unable to|never)\s+(?:be\s+|able to\s+)?(?:run|ran|execute|executed|started|available|installed)\b/i;

const SKIPPED = /\b(?:skipped|not installed|(?:aren't|isn't|is not|are not) installed)\b/i;

const BECAUSE = /\b(?:because|since)\b/i;

const CLAUSE_END = /,\s*(?:so|but|then|and so)\b/i;

const TRAILING = /[\s.,;:!]+$/;

type SentenceParams = {
  readonly sentence: string;
};

type TextParams = {
  readonly text: string;
};

const sentencesOf = ({ text }: TextParams): ReadonlyArray<string> =>
  text
    .replace(/[‘’]/g, "'")
    .split(/\n+|[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '');

const isSkipSentence = ({ sentence }: SentenceParams): boolean =>
  CHECK_WORD.test(sentence) && (NOT_RUN.test(sentence) || SKIPPED.test(sentence));

const skipReasonOf = ({ sentence }: SentenceParams): string => {
  const match = BECAUSE.exec(sentence);
  const because = match === null ? null : sentence.slice(match.index + match[0].length).trim();
  const clause = because === null ? sentence : (because.split(CLAUSE_END)[0] ?? because);
  return clause.replace(TRAILING, '').replace(/`/g, '');
};

export const checksSkippedOf = ({ text }: TextParams): ChecksSkipped | null => {
  const sentence = sentencesOf({ text }).find((candidate) =>
    isSkipSentence({ sentence: candidate }),
  );
  if (sentence === undefined) {
    return null;
  }
  const reason = skipReasonOf({ sentence });
  return reason === '' ? null : { reason };
};

type SkippedParams = {
  readonly skipped: ChecksSkipped;
};

export const checksSkippedLine = ({ skipped }: SkippedParams): string =>
  `Checks were skipped: ${skipped.reason}`;
