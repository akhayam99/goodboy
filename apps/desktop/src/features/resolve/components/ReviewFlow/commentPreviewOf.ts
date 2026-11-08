import { markdownPlainLinesOf } from '../../../../shared/utils/markdownPreview';

const RULE_LINE = /^[-*_=\s]{3,}$/;
const SEVERITY_SPLIT = /[|,·:]/;
const MAX_BOILERPLATE_WORDS = 8;
const MAX_PREVIEW = 2000;
const SEVERITY_WORDS: ReadonlySet<string> = new Set([
  'low',
  'medium',
  'high',
  'critical',
  'major',
  'minor',
  'nitpick',
  'trivial',
  'potential issue',
  'suggestion',
  'refactor',
  'severity',
  'priority',
]);
const BOILERPLATE_LINES: ReadonlyArray<RegExp> = [
  /^powered by \S/,
  /^was this (?:comment |review )?helpful\?$/,
  /^reply with [@/]\S/,
  /^prompt for (?:ai agents|all review comments)/,
  /^(?:learnt from|learnings used)\b.{0,40}:/,
  /^generated (?:by|with) \S/,
  /^this is an automated (?:message|comment|reply|review|summary)\b/,
  /^summary by \S/,
  /^walkthrough$/,
];

type TextParams = {
  readonly text: string;
};

const severityWordOf = ({ text }: TextParams): string =>
  text
    .replace(/[^a-z ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isSeverityLine = ({ text }: TextParams): boolean => {
  const parts = text
    .split(SEVERITY_SPLIT)
    .map((part) => severityWordOf({ text: part }))
    .filter((part) => part.length > 0);
  return parts.length > 0 && parts.every((part) => SEVERITY_WORDS.has(part));
};

const isBoilerplateLine = ({ text }: TextParams): boolean => {
  const lower = text.toLowerCase();
  const wordCount = lower.split(' ').length;
  return wordCount <= MAX_BOILERPLATE_WORDS && BOILERPLATE_LINES.some((rule) => rule.test(lower));
};

export const commentPreviewOf = ({ text }: TextParams): string =>
  (
    markdownPlainLinesOf({ text, shouldKeepOpenFence: false }).find(
      (line) =>
        !RULE_LINE.test(line) &&
        !isSeverityLine({ text: line }) &&
        !isBoilerplateLine({ text: line }),
    ) ?? ''
  ).slice(0, MAX_PREVIEW);
