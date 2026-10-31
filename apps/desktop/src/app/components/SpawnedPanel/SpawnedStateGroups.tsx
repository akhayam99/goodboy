import { useCallback, useMemo, useRef, useState } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { ObjectMenuArea } from '../../../features/actions/components/ObjectMenuArea';
import { openSpawned } from '../../../features/session/openSpawned';
import { parentIdsOf } from './parentIdsOf';
import type { FoldedSpawnedRow } from './foldSpawnedRowsOf';
import type { SpawnedRow } from './spawnedRow';
import { SpawnedStateHead } from './SpawnedStateHead';
import { SpawnedStateRow } from './SpawnedStateRow';
import type { SpawnedStateGroup } from './spawnedStateGroupsOf';
import { useSpawnedReveal } from './useSpawnedReveal';

type Props = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<SpawnedRow>;
  readonly groups: ReadonlyArray<SpawnedStateGroup>;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedStateGroups = ({ sessionId, rows, groups, selectedAgentId }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isDoneChosen, setIsDoneChosen] = useState<boolean | null>(null);
  const isFinished = groups.every((group) => group.key === 'done');
  const isDoneOpen = isFinished || (isDoneChosen ?? false);
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const parentById = useMemo(() => parentIdsOf({ nodes: rows }), [rows]);
  const shown = useMemo(
    (): ReadonlyArray<FoldedSpawnedRow> =>
      groups
        .filter((group) => group.key !== 'done' || isDoneOpen)
        .flatMap((group) => group.rows)
        .map((row) => ({
          row,
          count: 0,
          isExpanded: true,
          isFoldable: false,
          urgency: null,
          summary: null,
        })),
    [groups, isDoneOpen],
  );
  const onReveal = useCallback(() => setIsDoneChosen(true), []);
  useSpawnedReveal({ rootRef, selectedAgentId, rows, shown, onExpand: onReveal });
  return (
    <div
      ref={rootRef}
      data-spawned-states=""
      className={cn('min-w-0', PANE_RHYTHM.tree.stateGroups)}
    >
      {groups.map((group) => {
        const isDone = group.key === 'done';
        const isOpen = !isDone || isDoneOpen;
        return (
          <div key={group.key} data-spawned-state={group.key} className="flex min-w-0 flex-col">
            <SpawnedStateHead
              group={group}
              isFoldable={isDone && !isFinished}
              isOpen={isOpen}
              onSet={({ isOpen: isChosen }) => setIsDoneChosen(isChosen)}
            />
            {isOpen
              ? group.rows.map((row) => {
                  const parentId = parentById.get(row.id) ?? null;
                  const parent = parentId === null ? null : (rowById.get(parentId) ?? null);
                  return (
                    <ObjectMenuArea
                      key={row.id}
                      target={{ kind: 'agent', sessionId, agentId: row.agentId }}
                      anchorKey={`spawned:${row.id}`}
                    >
                      <SpawnedStateRow
                        row={row}
                        fromRole={parent === null || parent.level === 1 ? null : parent.role}
                        isWorking={group.key === 'working'}
                        isSelected={row.agentId === selectedAgentId}
                        onOpen={() =>
                          openSpawned({
                            sessionId,
                            target: { kind: 'agent', agentId: row.agentId },
                          })
                        }
                      />
                    </ObjectMenuArea>
                  );
                })
              : null}
          </div>
        );
      })}
    </div>
  );
};
