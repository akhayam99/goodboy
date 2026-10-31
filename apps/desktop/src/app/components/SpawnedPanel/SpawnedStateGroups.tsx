import { useMemo, useRef, useState } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { parentIdsOf } from './parentIdsOf';
import type { FoldedSpawnedRow } from './foldSpawnedRowsOf';
import type { SpawnedRow } from './spawnedRow';
import { SpawnedStateHead } from './SpawnedStateHead';
import { SpawnedStateRowItem } from './SpawnedStateRowItem';
import type { SpawnedStateGroup } from './spawnedStateGroupsOf';
import { useSpawnedFocusKeep } from './useSpawnedFocusKeep';
import { useSpawnedReveal } from './useSpawnedReveal';

type Props = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<SpawnedRow>;
  readonly rootRow: SpawnedRow | null;
  readonly groups: ReadonlyArray<SpawnedStateGroup>;
  readonly selectedAgentId: AgentId | null;
};

type RowParams = {
  readonly row: SpawnedRow;
};

const DONE_HEAD_ID = 'state:done';

const keepFolded = (): void => undefined;

export const SpawnedStateGroups = ({
  sessionId,
  rows,
  rootRow,
  groups,
  selectedAgentId,
}: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isDoneChosen, setIsDoneChosen] = useState<boolean | null>(null);
  const isFinished =
    groups.every((group) => group.key === 'done') && (rootRow === null || !rootRow.isLive);
  const isSelectedDone =
    selectedAgentId !== null &&
    groups.some(
      (group) => group.key === 'done' && group.rows.some((row) => row.agentId === selectedAgentId),
    );
  const isDoneOpen = isFinished || isSelectedDone || (isDoneChosen ?? false);
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const parentById = useMemo(() => parentIdsOf({ nodes: rows }), [rows]);
  const shown = useMemo(
    (): ReadonlyArray<FoldedSpawnedRow> =>
      [
        ...(rootRow === null ? [] : [rootRow]),
        ...groups
          .filter((group) => group.key !== 'done' || isDoneOpen)
          .flatMap((group) => group.rows),
      ].map((row) => ({
        row,
        count: 0,
        isExpanded: true,
        isFoldable: false,
        urgency: null,
        summary: null,
      })),
    [rootRow, groups, isDoneOpen],
  );
  useSpawnedReveal({ rootRef, selectedAgentId, rows, shown, onExpand: keepFolded });
  useSpawnedFocusKeep({ rootRef, fallbackId: DONE_HEAD_ID });
  const parentOf = ({ row }: RowParams): SpawnedRow | null => {
    const parentId = parentById.get(row.id) ?? null;
    return parentId === null ? null : (rowById.get(parentId) ?? null);
  };
  return (
    <div
      ref={rootRef}
      data-spawned-states=""
      className={cn('min-w-0', PANE_RHYTHM.tree.stateGroups)}
    >
      {rootRow === null ? null : (
        <SpawnedStateRowItem
          sessionId={sessionId}
          row={rootRow}
          level={1}
          parent={null}
          isWorking={rootRow.node === 'running' || rootRow.node === 'merging'}
          selectedAgentId={selectedAgentId}
        />
      )}
      {groups.map((group) => {
        const isDone = group.key === 'done';
        const isOpen = !isDone || isDoneOpen;
        return (
          <div key={group.key} data-spawned-state={group.key} className="flex min-w-0 flex-col">
            <SpawnedStateHead
              group={group}
              isFoldable={isDone && !isFinished && !isSelectedDone}
              isOpen={isOpen}
              onSet={({ isOpen: isChosen }) => setIsDoneChosen(isChosen)}
            />
            {isOpen
              ? group.rows.map((row) => (
                  <SpawnedStateRowItem
                    key={row.id}
                    sessionId={sessionId}
                    row={row}
                    level={2}
                    parent={parentOf({ row })}
                    isWorking={group.key === 'working'}
                    selectedAgentId={selectedAgentId}
                  />
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
};
