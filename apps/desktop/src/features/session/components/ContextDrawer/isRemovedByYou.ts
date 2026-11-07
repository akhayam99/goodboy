import type { SessionDecision } from '@goodboy/types';

type Params = { readonly row: SessionDecision };

export const isRemovedByYou = ({ row }: Params): boolean =>
  row.status === 'withdrawn' && row.closedBy === 'user';
