import type { DoneDay, DoneRowModel } from '../done/doneTypes';

const LATEST_DONE_LIMIT = 3;

export type LatestDoneItem = Readonly<{
  row: DoneRowModel;
  isUnread: boolean;
}>;

export type LatestDone = Readonly<{
  items: ReadonlyArray<LatestDoneItem>;
  unreadCount: number;
}>;

type Params = {
  readonly days: ReadonlyArray<DoneDay>;
  readonly unreadAgentIds: ReadonlySet<string>;
};

type RowParams = {
  readonly row: DoneRowModel;
  readonly unreadAgentIds: ReadonlySet<string>;
};

const isRowUnread = ({ row, unreadAgentIds }: RowParams): boolean =>
  row.agentIds.some((agentId) => unreadAgentIds.has(agentId));

export const latestDoneOf = ({ days, unreadAgentIds }: Params): LatestDone => {
  const rows = days.flatMap((day) => day.rows);
  const marked = rows.map((row): LatestDoneItem => ({
    row,
    isUnread: isRowUnread({ row, unreadAgentIds }),
  }));
  return {
    items: marked.slice(0, LATEST_DONE_LIMIT),
    unreadCount: marked.filter((item) => item.isUnread).length,
  };
};
