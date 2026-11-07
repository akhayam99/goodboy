import type { SessionDecision } from '@goodboy/types';

type Params = { readonly row: SessionDecision; readonly query: string };

export const matchesClosedSearch = ({ row, query }: Params): boolean => {
  const trimmed = query.trim().toLowerCase().replace(/^#/, '');
  if (trimmed === '') {
    return true;
  }
  return row.text.toLowerCase().includes(trimmed) || String(row.number).startsWith(trimmed);
};
