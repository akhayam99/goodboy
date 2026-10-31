import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { WorkNode } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { DelegationClock } from '../../../features/auto/chat/DelegationClock';
import { foldSpawnedRowsOf } from './foldSpawnedRowsOf';
import { openSpawned } from '../../../features/session/openSpawned';
import { helpersWordOf } from './helpersWordOf';
import { spawnedRailOf } from './spawnedRailOf';
import { SpawnedFoldRow } from './SpawnedFoldRow';
import { ObjectMenuArea } from '../../../features/actions/components/ObjectMenuArea';
import { SpawnedTreeRow } from './SpawnedTreeRow';
import { useAutoSpawnedRows } from './useAutoSpawnedRows';
import { useSpawnedReveal } from './useSpawnedReveal';

type SetParams = {
  readonly id: string;
  readonly isExpanded: boolean;
};

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedAutoGroup = ({ sessionId, rootAgentId, selectedAgentId }: Props) => {
  const { rows, isLoaded } = useAutoSpawnedRows({ sessionId, rootAgentId });
  const isLiveNow = rows.some((row) => row.isLive);
  const [wasLiveAtLoad, setWasLiveAtLoad] = useState<boolean | null>(isLoaded ? isLiveNow : null);
  if (wasLiveAtLoad === null && isLoaded) {
    setWasLiveAtLoad(isLiveNow);
  }
  const isOpenByDefault = wasLiveAtLoad ?? isLiveNow;
  const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>({});
  const shown = useMemo(
    () => foldSpawnedRowsOf({ rows, expanded, isOpenByDefault }),
    [rows, expanded, isOpenByDefault],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const onSet = useCallback(({ id, isExpanded }: SetParams) => {
    setExpanded((current) => ({ ...current, [id]: isExpanded }));
  }, []);
  const onExpand = useCallback((ids: ReadonlyArray<string>) => {
    setExpanded((current) => ({
      ...current,
      ...Object.fromEntries(ids.map((id) => [id, true])),
    }));
  }, []);
  useSpawnedReveal({ rootRef, selectedAgentId, rows, shown, onExpand });
  const rail = useMemo(
    () =>
      spawnedRailOf({
        nodes: shown.flatMap(({ row, summary }) => [
          { id: row.id, level: row.level, isPending: row.node === 'queued' },
          ...(summary === null ? [] : [{ id: summary.id, level: summary.level, isPending: false }]),
        ]),
      }),
    [shown],
  );
  return (
    <div ref={rootRef} data-spawned-launch="" className="flex min-w-0 flex-col-reverse">
      {shown.map(({ row, count, isExpanded, isFoldable, urgency, summary }) => {
        const rowRail = rail.railById.get(row.id);
        if (rowRail === undefined) {
          return null;
        }
        const summaryRail = summary === null ? undefined : rail.railById.get(summary.id);
        return (
          <Fragment key={row.id}>
            <ObjectMenuArea
              target={{ kind: 'agent', sessionId, agentId: row.agentId }}
              anchorKey={`spawned:${row.id}`}
            >
              <SpawnedTreeRow
                id={row.id}
                agentId={row.agentId}
                level={row.level}
                hasChildren={row.hasChildren && (summary === null || isExpanded)}
                rail={rowRail}
                railWidth={rail.width}
                glyph={
                  <WorkNode state={row.node} label={row.word} mark={{ kind: 'dot' }} size="sm" />
                }
                role={row.role}
                title={row.title}
                card={row.card}
                word={row.word}
                model={row.model}
                time={<DelegationClock agentId={row.agentId} isLive={row.isLive} />}
                isSelected={row.agentId === selectedAgentId}
                fold={
                  isFoldable
                    ? {
                        isExpanded,
                        count,
                        urgency,
                        onToggle: () => onSet({ id: row.id, isExpanded: !isExpanded }),
                      }
                    : null
                }
                onOpen={() =>
                  openSpawned({ sessionId, target: { kind: 'agent', agentId: row.agentId } })
                }
              />
            </ObjectMenuArea>
            {summary === null || summaryRail === undefined ? null : (
              <SpawnedFoldRow
                fold={{
                  id: summary.id,
                  expandId: row.id,
                  level: summary.level,
                  isExpanded,
                  label: helpersWordOf({ count }),
                }}
                rail={summaryRail}
                railWidth={rail.width}
                urgency={urgency}
                onSet={onSet}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
};
