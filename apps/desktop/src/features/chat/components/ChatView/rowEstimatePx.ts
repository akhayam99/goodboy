import type { ConversationRow } from '../../utils/conversationRows';

type Params = {
  readonly row: ConversationRow;
  readonly isClusterOpen: boolean;
};

type TextParams = {
  readonly text: string;
  readonly charsPerLine: number;
};

const DEFAULT_ROW_PX = 72;
const OPERATION_ROW_PX = 32;
const OPERATION_PADDING_PX = 16;
const COLLAPSED_CLUSTER_PX = 32;
const SUMMARY_ROW_PX = 32;
const PLAN_ITEM_PX = 24;
const PLAN_ITEM_CAP = 12;
const USER_LINE_PX = 24;
const USER_PADDING_PX = 40;
const ASSISTANT_LINE_PX = 24;
const ASSISTANT_PADDING_PX = 24;
const USER_CHARS_PER_LINE = 72;
const ASSISTANT_CHARS_PER_LINE = 88;

const lineCountOf = ({ text, charsPerLine }: TextParams): number =>
  text
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);

export const rowEstimatePx = ({ row, isClusterOpen }: Params): number => {
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
  if (item.kind === 'user_text' || item.kind === 'handoff') {
    return (
      USER_PADDING_PX +
      USER_LINE_PX * lineCountOf({ text: item.text, charsPerLine: USER_CHARS_PER_LINE })
    );
  }
  if (item.kind === 'assistant_text') {
    return (
      ASSISTANT_PADDING_PX +
      ASSISTANT_LINE_PX * lineCountOf({ text: item.text, charsPerLine: ASSISTANT_CHARS_PER_LINE })
    );
  }
  return DEFAULT_ROW_PX;
};
