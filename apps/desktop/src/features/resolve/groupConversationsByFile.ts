import type { ResolveQueueRow } from './buildResolveQueueRows';

export type ConversationGroup = {
  readonly key: string;
  readonly path: string | null;
  readonly rows: ReadonlyArray<ResolveQueueRow>;
};

const NO_FILE_KEY = 'no-file';

const lineOf = ({ row }: { readonly row: ResolveQueueRow }): number =>
  row.reviewerNote?.line ?? Number.MAX_SAFE_INTEGER;

const byLineThenAge = (a: ResolveQueueRow, b: ResolveQueueRow): number => {
  const line = lineOf({ row: a }) - lineOf({ row: b });
  return line === 0 ? a.thread.createdAt - b.thread.createdAt : line;
};

export const groupConversationsByFile = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): ReadonlyArray<ConversationGroup> => {
  const byPath = new Map<string, Array<ResolveQueueRow>>();
  for (const row of rows) {
    const key = row.reviewerNote?.path ?? NO_FILE_KEY;
    byPath.set(key, [...(byPath.get(key) ?? []), row]);
  }
  return [...byPath.entries()]
    .map(([key, grouped]) => ({
      key,
      path: key === NO_FILE_KEY ? null : key,
      rows: [...grouped].sort(byLineThenAge),
    }))
    .sort((a, b) => {
      if (a.path === null) {
        return 1;
      }
      if (b.path === null) {
        return -1;
      }
      return a.path.localeCompare(b.path);
    });
};
