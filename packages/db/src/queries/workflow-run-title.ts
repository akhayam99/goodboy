import { stripTitlePreamble } from './title-preamble';

const WORKFLOW_RUN_TITLE_MAX_LENGTH = 60;

const MAX_TITLE_WORDS = 10;

const ELLIPSIS = '…';

const LEAK_PATTERN =
  /^(?:the user (?:asked|wants|said|wrote|is|needs|has)\b|user (?:asked|wants|said|wrote)\b|i(?:'ll|'d| will| would| need| should| am| have)\b|let me\b|here(?:'s| is| are)\b|this (?:run|workflow) (?:is|will|needs)\b)/i;

const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?]+$/;

type TextParams = {
  readonly text: string;
};

type ClampParams = TextParams & {
  readonly isEllipsisAllowed: boolean;
};

const leadingLineOf = ({ text }: TextParams): string =>
  text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';

const clampAtWord = ({ text, isEllipsisAllowed }: ClampParams): string => {
  if (text.length <= WORKFLOW_RUN_TITLE_MAX_LENGTH) {
    return text;
  }
  const room = WORKFLOW_RUN_TITLE_MAX_LENGTH - (isEllipsisAllowed ? ELLIPSIS.length : 0);
  const lastSpace = text.lastIndexOf(' ', room);
  const cut = text.slice(0, lastSpace > 0 ? lastSpace : room).trimEnd();
  return isEllipsisAllowed ? `${cut}${ELLIPSIS}` : cut;
};

const isUsableTitle = ({ text }: TextParams): boolean =>
  text !== '' && !LEAK_PATTERN.test(text) && text.split(/\s+/).length <= MAX_TITLE_WORDS;

type Params = {
  readonly title: string | null | undefined;
  readonly goal: string | null | undefined;
};

export const cleanWorkflowRunTitle = ({ title, goal }: Params): string => {
  const unlabeled = stripTitlePreamble({ text: leadingLineOf({ text: title ?? '' }) });
  const candidate = stripTitlePreamble({
    text: unlabeled.replace(TRAILING_PUNCTUATION_PATTERN, ''),
  }).trim();
  if (isUsableTitle({ text: candidate })) {
    return clampAtWord({ text: candidate, isEllipsisAllowed: false });
  }
  const fallback = stripTitlePreamble({ text: leadingLineOf({ text: goal ?? '' }) }).trim();
  if (fallback === '') {
    return '';
  }
  return clampAtWord({ text: fallback, isEllipsisAllowed: true });
};
