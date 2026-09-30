import type { ResolveQueueRow } from './buildResolveQueueRows';
import { threadFixSha } from './threadFixSha';

export const conversationSha = ({ row }: { readonly row: ResolveQueueRow }): string | null =>
  threadFixSha({ commitShas: row.thread.commitShas, integratedSha: row.item.integratedSha });
