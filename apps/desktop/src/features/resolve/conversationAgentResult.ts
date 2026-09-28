import type { ResolveQueueRow } from './buildResolveQueueRows';

export const conversationSha = ({ row }: { readonly row: ResolveQueueRow }): string | null =>
  row.item.integratedSha ?? row.thread.commitShas?.at(-1) ?? null;
