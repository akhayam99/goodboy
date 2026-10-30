import { formatDate } from '../../../../shared/utils/time/formatDate';
import { formatDayMonth } from '../../../../shared/utils/time/formatDayMonth';
import type { ConversationRow } from '../../utils/conversationRows';
import type { TranscriptItem } from '../../utils/transcript-items';

type RowAnchorParams = {
  readonly row: ConversationRow;
  readonly heightKey: string;
};

type RowAnchor = {
  readonly 'data-anchor-key': string;
  readonly 'data-tool-use-ids'?: string;
};

type RowItemsParams = {
  readonly row: ConversationRow;
};

const itemsOfRow = ({ row }: RowItemsParams): ReadonlyArray<TranscriptItem> => {
  if (row.kind === 'operations') {
    return row.items;
  }
  if (row.kind === 'summary') {
    return row.steps;
  }
  if (row.kind === 'item') {
    return [row.item];
  }
  return [];
};

export const rowAnchorOf = ({ row, heightKey }: RowAnchorParams): RowAnchor => {
  const ids = itemsOfRow({ row }).flatMap((item) =>
    item.kind === 'tool_call' ? [item.toolUseId] : [],
  );
  return ids.length === 0
    ? { 'data-anchor-key': heightKey }
    : { 'data-anchor-key': heightKey, 'data-tool-use-ids': ids.join(' ') };
};

export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return 'unknown';
  }
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export const formatDayLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  if (d.getFullYear() === new Date().getFullYear()) {
    return formatDayMonth({ at: iso });
  }
  return formatDate({ at: iso });
};
