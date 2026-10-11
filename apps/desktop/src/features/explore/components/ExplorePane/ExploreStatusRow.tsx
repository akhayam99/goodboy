import { Button, Skeleton } from '@goodboy/ui';
import { openSettings } from '../../../settings/openSettings';
import type { LoadFolderParams } from '../../exploreHandlers';
import type { ExploreStatusRow as StatusRow } from '../../exploreRows';
import { ExploreIndent } from './ExploreIndent';

type Props = {
  readonly row: StatusRow;
  readonly onRetry: (params: LoadFolderParams) => void;
};

const LINE = 'min-w-0 truncate text-meta text-faint-foreground';

export const ExploreStatusRow = ({ row, onRetry }: Props) => (
  <div
    role="none"
    data-slot="explore-status-row"
    className="flex h-10 w-full min-w-0 items-center gap-2 pl-2 pr-3"
  >
    <ExploreIndent depth={row.depth} />
    <span aria-hidden className="w-3.5 shrink-0" />
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
    {row.kind === 'failure' ? (
      <>
        <span className="min-w-0 truncate text-meta text-danger">{row.message}</span>
        {row.isEditorMissing ? (
          <Button
            size="xs"
            variant="quiet"
            onClick={() => openSettings({ scope: 'app', section: 'general' })}
          >
            Choose editor
          </Button>
        ) : null}
      </>
    ) : null}
  </div>
);
