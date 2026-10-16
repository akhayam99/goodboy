import { useId, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { ARTIFACT_GROUP_LABEL, type ArtifactListRow as Row } from '../../artifactListRows';
import type { ArtifactGroup } from '../../artifactStateOf';
import { ArtifactListRow } from './ArtifactListRow';

type Props = {
  readonly group: ArtifactGroup;
  readonly rows: ReadonlyArray<Row>;
  readonly sessionId: SessionId;
  readonly openPartsIds: ReadonlySet<string>;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (row: Row) => void;
};

const SHOW_BUTTON =
  'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const ArtifactListGroup = ({
  group,
  rows,
  sessionId,
  openPartsIds,
  onTogglePartsOf,
  onOpenRow,
}: Props) => {
  const headingId = useId();
  const listId = useId();
  const isTrash = group === 'deleted';
  const [isTrashShown, setIsTrashShown] = useState(false);
  const isShown = !isTrash || isTrashShown;
  return (
    <section
      data-testid={`artifact-group-${group}`}
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col"
    >
      <div className="flex h-7 min-w-0 items-center gap-2">
        <h2 id={headingId} className="flex items-center gap-2 text-label text-muted-foreground">
          {ARTIFACT_GROUP_LABEL[group]}
          <span className="tabular-nums text-faint-foreground">{rows.length}</span>
        </h2>
        {isTrash ? (
          <button
            type="button"
            className={SHOW_BUTTON}
            aria-expanded={isTrashShown}
            aria-controls={listId}
            onClick={() => setIsTrashShown((isOpen) => !isOpen)}
          >
            {isTrashShown ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
      {isTrash && isTrashShown ? (
        <p className="pr-2 pb-2 text-label text-faint-foreground">
          Deleted artifacts stay here. Restore them, or delete them for good.
        </p>
      ) : null}
      {isShown ? (
        <ul id={listId} className="flex min-w-0 flex-col">
          {rows.map((row) => (
            <li key={row.id} className="min-w-0">
              <ArtifactListRow
                row={row}
                sessionId={sessionId}
                isPartsOpen={openPartsIds.has(row.id)}
                onTogglePartsOf={onTogglePartsOf}
                onOpenRow={onOpenRow}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
