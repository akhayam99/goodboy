import type { ConversationRow } from '../../utils/conversationRows';

type Params = {
  readonly row: ConversationRow;
  readonly isClusterOpen: boolean;
  readonly clampLines?: number | null;
};

type TextParams = {
  readonly text: string;
  readonly charsPerLine: number;
};

type LineParams = {
  readonly line: string;
  readonly charsPerLine: number;
};

type AnswerParams = {
  readonly text: string;
  readonly clampLines: number | null;
};

type UserParams = {
  readonly text: string;
};

type AnswerLines = {
  readonly lines: number;
  readonly fixedPx: number;
  readonly hasBlock: boolean;
};

const DEFAULT_ROW_PX = 72;
const OPERATION_ROW_PX = 32;
const OPERATION_PADDING_PX = 16;
const COLLAPSED_CLUSTER_PX = 32;
const SUMMARY_ROW_PX = 32;
const PLAN_ITEM_PX = 24;
const PLAN_ITEM_CAP = 12;
const LINE_PX = 24;
const PARAGRAPH_GAP_PX = 12;
const CODE_LINE_PX = 20;
const CODE_FRAME_PX = 40;
const USER_PADDING_PX = 40;
const USER_CLAMP_LINES = 8;
const ASSISTANT_PADDING_PX = 24;
const SHOW_MORE_PX = 32;
const READING_COLUMN_PX = 880;
const USER_INSET_PX = 72;
const PROSE_CHAR_PX = 7.8;
const ASSISTANT_CHARS_PER_LINE = Math.floor(READING_COLUMN_PX / PROSE_CHAR_PX);
const USER_CHARS_PER_LINE = Math.floor((READING_COLUMN_PX - USER_INSET_PX) / PROSE_CHAR_PX);
const FENCE = '```';
const TABLE_START = '|';

const wrappedLinesOf = ({ line, charsPerLine }: LineParams): number =>
  Math.max(1, Math.ceil(line.length / charsPerLine));

const lineCountOf = ({ text, charsPerLine }: TextParams): number =>
  text.split('\n').reduce((sum, line) => sum + wrappedLinesOf({ line, charsPerLine }), 0);

const answerLinesOf = ({ text, charsPerLine }: TextParams): AnswerLines => {
  let lines = 0;
  let fixedPx = 0;
  let isInFence = false;
  let hasBlock = false;
  for (const line of text.split('\n')) {
    const start = line.trimStart();
    if (start.startsWith(FENCE)) {
      hasBlock = true;
      fixedPx += isInFence ? 0 : CODE_FRAME_PX;
      isInFence = !isInFence;
      continue;
    }
    if (isInFence) {
      fixedPx += CODE_LINE_PX;
      continue;
    }
    if (start === '') {
      fixedPx += PARAGRAPH_GAP_PX;
      continue;
    }
    hasBlock = hasBlock || start.startsWith(TABLE_START);
    lines += wrappedLinesOf({ line, charsPerLine });
  }
  return { lines, fixedPx, hasBlock };
};

const answerEstimatePx = ({ text, clampLines }: AnswerParams): number => {
  const { lines, fixedPx, hasBlock } = answerLinesOf({
    text,
    charsPerLine: ASSISTANT_CHARS_PER_LINE,
  });
  if (clampLines !== null && !hasBlock && lines > clampLines) {
    return ASSISTANT_PADDING_PX + LINE_PX * clampLines + SHOW_MORE_PX;
  }
  return ASSISTANT_PADDING_PX + LINE_PX * lines + fixedPx;
};

const userEstimatePx = ({ text }: UserParams): number => {
  const lines = lineCountOf({ text, charsPerLine: USER_CHARS_PER_LINE });
  if (lines > USER_CLAMP_LINES) {
    return USER_PADDING_PX + LINE_PX * USER_CLAMP_LINES + SHOW_MORE_PX;
  }
  return USER_PADDING_PX + LINE_PX * lines;
};

export const rowEstimatePx = ({ row, isClusterOpen, clampLines = null }: Params): number => {
  if (row.kind === 'summary') {
    return SUMMARY_ROW_PX;
  }
  if (row.kind === 'plan') {
    return (
      OPERATION_PADDING_PX + PLAN_ITEM_PX * Math.min(row.checklist.items.length, PLAN_ITEM_CAP)
    );
  }
  if (row.kind === 'operations') {
    if (!isClusterOpen) {
      return COLLAPSED_CLUSTER_PX;
    }
    return COLLAPSED_CLUSTER_PX + OPERATION_PADDING_PX + OPERATION_ROW_PX * row.items.length;
  }
  const { item } = row;
  if (item.kind === 'user_text') {
    return userEstimatePx({ text: item.text });
  }
  if (item.kind === 'handoff') {
    return (
      USER_PADDING_PX +
      LINE_PX * lineCountOf({ text: item.text, charsPerLine: USER_CHARS_PER_LINE })
    );
  }
  if (item.kind === 'assistant_text') {
    return answerEstimatePx({ text: item.text, clampLines });
  }
  return DEFAULT_ROW_PX;
};
