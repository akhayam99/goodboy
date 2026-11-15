import { Button, Skeleton, treeIndentPx } from '@goodboy/ui';
import type { ExploreStatusRow } from '../../../explore/exploreRows';
import { ALL_FILES_ROW_PX } from '../../lib/allFilesListing';

type RetryParams = {
  readonly relPath: string;
};

type Props = {
  readonly row: ExploreStatusRow;
  readonly onRetry: (params: RetryParams) => void;
};

const LINE = 'min-w-0 truncate text-meta text-faint-foreground';

export const AllFilesStatusRow = ({ row, onRetry }: Props) => (
  <li
    role="none"
    data-slot="all-files-status-row"
    style={{ paddingLeft: treeIndentPx({ depth: row.depth }) + 22, height: ALL_FILES_ROW_PX }}
    className="flex w-full min-w-0 list-none items-center gap-2 pr-2"
  >
    {row.kind === 'loading' ? <Skeleton className="h-4 w-1/3 rounded-sm" /> : null}
    {row.kind === 'empty' ? <span className={LINE}>This folder is empty</span> : null}
    {row.kind === 'error' ? (
      <>
        <span className="shrink-0 text-meta text-danger">Couldn&apos;t read this folder</span>
        <span className={LINE}>{row.message}</span>
        <Button size="xs" variant="quiet" onClick={() => onRetry({ relPath: row.parentPath })}>
          Retry
        </Button>
      </>
    ) : null}
  </li>
);
