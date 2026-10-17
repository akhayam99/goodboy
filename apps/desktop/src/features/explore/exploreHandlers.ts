import type { ExploreEntry } from './explore';
import type { ExploreOpenFailure } from './openFailure';

export type SetExpandedParams = {
  readonly path: string;
  readonly isExpanded: boolean;
};

export type SelectFileParams = {
  readonly entry: ExploreEntry;
};

export type LoadFolderParams = {
  readonly relPath: string;
};

export type OpenEntryParams = {
  readonly entry: ExploreEntry;
  readonly isReveal: boolean;
};

export type FailureParams = {
  readonly relPath: string;
  readonly failure: ExploreOpenFailure | null;
};

export type FocusRowParams = {
  readonly id: string;
};
