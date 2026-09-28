import type { ProjectId, SearchKind } from '@goodboy/types';

export type SearchChip =
  | { readonly key: 'type'; readonly kinds: ReadonlyArray<SearchKind>; readonly label: string }
  | { readonly key: 'project'; readonly projectId: ProjectId; readonly label: string }
  | { readonly key: 'provider'; readonly provider: string; readonly label: string }
  | { readonly key: 'status'; readonly status: string; readonly label: string }
  | { readonly key: 'archived'; readonly label: string }
  | { readonly key: 'after'; readonly at: number; readonly label: string }
  | { readonly key: 'before'; readonly at: number; readonly label: string };

export type SearchChipKey = SearchChip['key'];

export const CHIP_KEY_LABEL: Readonly<Record<SearchChipKey, string>> = {
  type: 'Type',
  project: 'Project',
  provider: 'Provider',
  status: 'Status',
  archived: 'Archived',
  after: 'After',
  before: 'Before',
};
