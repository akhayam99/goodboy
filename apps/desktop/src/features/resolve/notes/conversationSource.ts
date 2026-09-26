import type { ResolveConversationSource, ResolveQueueRow } from '../buildResolveQueueRows';

export type ConversationSourceFilter = 'all' | ResolveConversationSource;

export type ConversationSourceOption = {
  readonly value: ConversationSourceFilter;
  readonly label: string;
  readonly badge: number;
};

export const conversationSourceOf = ({
  row,
}: {
  readonly row: ResolveQueueRow;
}): ResolveConversationSource => (row.thread.originKind === 'diff_comment' ? 'note' : 'github');

export const conversationSourceOptions = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): ReadonlyArray<ConversationSourceOption> | null => {
  const notes = rows.filter((row) => conversationSourceOf({ row }) === 'note').length;
  const github = rows.length - notes;
  if (notes === 0 || github === 0) {
    return null;
  }
  return [
    { value: 'all', label: 'All', badge: rows.length },
    { value: 'github', label: 'GitHub', badge: github },
    { value: 'note', label: 'Notes', badge: notes },
  ];
};

export const rowsFromSource = ({
  rows,
  filter,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
  readonly filter: ConversationSourceFilter;
}): ReadonlyArray<ResolveQueueRow> =>
  filter === 'all' ? rows : rows.filter((row) => conversationSourceOf({ row }) === filter);
