import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { ListGridGroup, ListGridRow } from '@goodboy/ui';
import { ARTIFACT_GROUP_LABEL, type ArtifactListRow as Row } from '../../artifactListRows';
import type { ArtifactGroup } from '../../artifactStateOf';
import type { ArtifactOpenParams } from './artifactBranchProps';
import { ArtifactWorkRow } from './ArtifactWorkRow';

type Props = {
  readonly group: ArtifactGroup;
  readonly rows: ReadonlyArray<Row>;
  readonly sessionId: SessionId;
  readonly openPartsIds: ReadonlySet<string>;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (params: ArtifactOpenParams) => void;
};

const TRASH_NOTE = 'Deleted artifacts stay here. Restore them, or delete them for good.';

export const ArtifactStateGroup = ({
  group,
  rows,
  sessionId,
  openPartsIds,
  onTogglePartsOf,
  onOpenRow,
}: Props) => {
  const isTrash = group === 'deleted';
  const [isTrashShown, setIsTrashShown] = useState(false);
  const isShown = !isTrash || isTrashShown;
  return (
    <ListGridGroup
      headingLevel={2}
      label={ARTIFACT_GROUP_LABEL[group]}
      count={rows.length}
      fold={
        isTrash
          ? {
              label: isTrashShown ? 'Hide' : 'Show',
              onToggle: () => setIsTrashShown((isOpen) => !isOpen),
            }
          : undefined
      }
      lead={
        isTrash && isTrashShown ? (
          <ListGridRow
            cells={{
              byKey: {
                title: (
                  <span className="truncate text-meta text-faint-foreground">{TRASH_NOTE}</span>
                ),
              },
            }}
          />
        ) : undefined
      }
    >
      {isShown
        ? rows.map((row) => (
            <ArtifactWorkRow
              key={row.id}
              row={row}
              rowKey={row.id}
              sessionId={sessionId}
              isPartsOpen={openPartsIds.has(row.id)}
              onTogglePartsOf={onTogglePartsOf}
              onOpenRow={onOpenRow}
            />
          ))
        : null}
    </ListGridGroup>
  );
};
