import type { ExploreEntry } from './explore';
import type { ExploreOpenFailure } from './openFailure';

export const EXPLORE_ROW_PX = 40;
export const EXPLORE_ROOT_PATH = '';

export type ExploreListing = {
  readonly entriesByPath: Readonly<Record<string, ReadonlyArray<ExploreEntry>>>;
  readonly loadingByPath: Readonly<Record<string, boolean>>;
  readonly errorByPath: Readonly<Record<string, string | null>>;
};

type FlattenParams = ExploreListing & {
  readonly expanded: Readonly<Record<string, boolean>>;
  readonly failureByPath?: Readonly<Record<string, ExploreOpenFailure | null>>;
};

export type ExploreEntryRow = {
  readonly kind: 'entry';
  readonly id: string;
  readonly entry: ExploreEntry;
  readonly depth: number;
  readonly parentPath: string;
  readonly isExpanded: boolean;
};

export type ExploreStatusRow = {
  readonly kind: 'loading' | 'error' | 'empty' | 'failure';
  readonly id: string;
  readonly depth: number;
  readonly parentPath: string;
  readonly isFetching: boolean;
  readonly message: string | null;
  readonly isEditorMissing: boolean;
};

export type ExploreRow = ExploreEntryRow | ExploreStatusRow;

type StatusRowParams = {
  readonly kind: ExploreStatusRow['kind'];
  readonly depth: number;
  readonly parentPath: string;
  readonly isFetching?: boolean;
  readonly message?: string | null;
  readonly isEditorMissing?: boolean;
};

const statusRow = ({
  kind,
  depth,
  parentPath,
  isFetching = false,
  message = null,
  isEditorMissing = false,
}: StatusRowParams): ExploreStatusRow => ({
  kind,
  id: `/status/${kind}/${parentPath}`,
  depth,
  parentPath,
  isFetching,
  message,
  isEditorMissing,
});

type VisitParams = {
  readonly path: string;
  readonly depth: number;
};

export const flattenExploreRows = ({
  entriesByPath,
  loadingByPath,
  errorByPath,
  expanded,
  failureByPath = {},
}: FlattenParams): ReadonlyArray<ExploreRow> => {
  const rows: ExploreRow[] = [];
  const visit = ({ path, depth }: VisitParams): void => {
    for (const entry of entriesByPath[path] ?? []) {
      const isExpanded = entry.isDir && expanded[entry.relPath] === true;
      rows.push({ kind: 'entry', id: entry.relPath, entry, depth, parentPath: path, isExpanded });
      const failure = failureByPath[entry.relPath] ?? null;
      if (failure !== null) {
        rows.push(
          statusRow({
            kind: 'failure',
            depth: depth + 1,
            parentPath: entry.relPath,
            message: failure.message,
            isEditorMissing: failure.isEditorMissing,
          }),
        );
      }
      if (!isExpanded) {
        continue;
      }
      const children = entriesByPath[entry.relPath];
      const isFetching = loadingByPath[entry.relPath] === true;
      const error = errorByPath[entry.relPath] ?? null;
      const childDepth = depth + 1;
      if (children === undefined && isFetching) {
        rows.push(
          statusRow({ kind: 'loading', depth: childDepth, parentPath: entry.relPath, isFetching }),
        );
        continue;
      }
      if (error !== null) {
        rows.push(
          statusRow({
            kind: 'error',
            depth: childDepth,
            parentPath: entry.relPath,
            message: error,
          }),
        );
        continue;
      }
      if (children === undefined) {
        rows.push(statusRow({ kind: 'loading', depth: childDepth, parentPath: entry.relPath }));
        continue;
      }
      if (children.length === 0) {
        rows.push(statusRow({ kind: 'empty', depth: childDepth, parentPath: entry.relPath }));
        continue;
      }
      visit({ path: entry.relPath, depth: childDepth });
    }
  };
  visit({ path: EXPLORE_ROOT_PATH, depth: 0 });
  return rows;
};

export const exploreRowHeight = (): number => EXPLORE_ROW_PX;

export const entryRowsOf = (rows: ReadonlyArray<ExploreRow>): ReadonlyArray<ExploreEntryRow> =>
  rows.filter((row): row is ExploreEntryRow => row.kind === 'entry');

export const pendingFoldersOf = (rows: ReadonlyArray<ExploreRow>): ReadonlyArray<string> =>
  rows.flatMap((row) => (row.kind === 'loading' && !row.isFetching ? [row.parentPath] : []));

export const ancestorPathsOf = ({
  relPath,
}: {
  readonly relPath: string;
}): ReadonlyArray<string> => {
  const segments = relPath.split('/').filter((segment) => segment !== '');
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'));
};
