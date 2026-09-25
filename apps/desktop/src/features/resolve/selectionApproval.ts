import type { ResolveQueueRow } from './buildResolveQueueRows';

export type SelectionApproval = {
  readonly approvable: ReadonlyArray<ResolveQueueRow>;
  readonly nothingToApprove: number;
};

export const isApprovableRow = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.status === 'ready' && row.proposalKind !== 'none';

export const selectionApproval = ({
  rows,
  threadIds,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
  readonly threadIds: ReadonlySet<string>;
}): SelectionApproval => {
  const selected = rows.filter((row) => threadIds.has(row.thread.threadId));
  const approvable = selected.filter((row) => isApprovableRow({ row }));
  return { approvable, nothingToApprove: selected.length - approvable.length };
};
