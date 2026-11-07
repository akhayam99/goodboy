import type { WorkspaceId } from '@goodboy/types';
import type { InboxKind, InboxProvider } from '../../types';
import type { InboxFilters, InboxKindFilter } from '../../kindFilter';
import { readInboxFilters } from '../../kindFilterStorage';

type KindToFilterParams = {
  readonly kind: InboxKind;
};

const kindToFilter = ({ kind }: KindToFilterParams): InboxKindFilter => {
  switch (kind) {
    case 'issue':
      return 'issue';
    case 'pr':
    case 'mr':
      return 'pr-mr';
    case 'thread':
      return 'thread';
    case 'error':
      return 'error';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

type InitialFiltersParams = {
  readonly workspaceId: WorkspaceId;
  readonly initialKind: InboxKind | null;
  readonly initialProvider: InboxProvider | null;
};

export const initialFilters = ({
  workspaceId,
  initialKind,
  initialProvider,
}: InitialFiltersParams): InboxFilters => {
  const stored = readInboxFilters({ workspaceId });
  return {
    view: 'all',
    kind: initialKind != null ? kindToFilter({ kind: initialKind }) : (stored?.kind ?? 'all'),
    source: initialProvider ?? (initialKind != null ? null : (stored?.source ?? null)),
    project: null,
  };
};
