import { useMemo, useState } from 'react';
import { WorkNode } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore, useTranscript } from '../../../store';
import { autoRootTitleOf } from '../../../features/session/components/AutoAgentsPane/autoRootTitleOf';
import { DelegationClock } from '../../../features/auto/chat/DelegationClock';
import { useAutoTreeRows } from '../../../features/auto/useAutoTreeRows';
import { autoSpawnedRowsOf } from './autoSpawnedRowsOf';
import { foldSpawnedRowsOf } from './foldSpawnedRowsOf';
import { openSpawned } from '../../../features/session/openSpawned';
import { spawnedRailOf } from './spawnedRailOf';
import { ObjectMenuArea } from '../../../features/actions/components/ObjectMenuArea';
import { SpawnedTreeRow } from './SpawnedTreeRow';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedAutoGroup = ({ sessionId, rootAgentId, selectedAgentId }: Props) => {
  const model = useAutoTreeRows({ sessionId, agentId: rootAgentId });
  const rootName = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === rootAgentId)?.name ??
      'Auto',
  );
  const events = useTranscript(rootAgentId);
  const ask = model.tree?.view.rootAsk ?? null;
  const rootTitle = useMemo(
    () => autoRootTitleOf({ name: rootName, ask, events }),
    [rootName, ask, events],
  );
  const rows = useMemo(
    () =>
      autoSpawnedRowsOf({ rows: model.rows, baseLevel: 1 }).map((row) =>
        row.level === 1 ? { ...row, title: rootTitle } : row,
      ),
    [model.rows, rootTitle],
  );
  const isLiveNow = rows.some((row) => row.isLive);
  const isLoaded = model.tree !== null;
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
  const rail = useMemo(
    () =>
      spawnedRailOf({
        nodes: shown.map(({ row }) => ({
          id: row.id,
          level: row.level,
          isPending: row.node === 'queued',
        })),
      }),
    [shown],
  );
  return (
    <div data-spawned-launch="" className="flex min-w-0 flex-col-reverse">
      {shown.map(({ row, count, isExpanded }) => {
        const rowRail = rail.railById.get(row.id);
        if (rowRail === undefined) {
          return null;
        }
        return (
          <ObjectMenuArea
            key={row.id}
            target={{ kind: 'agent', sessionId, agentId: row.agentId }}
            anchorKey={`spawned:${row.id}`}
          >
            <SpawnedTreeRow
              id={row.id}
              level={row.level}
              hasChildren={row.hasChildren}
              rail={rowRail}
              railWidth={rail.width}
              glyph={
                <WorkNode state={row.node} label={row.word} mark={{ kind: 'dot' }} size="sm" />
              }
              role={row.role}
              title={row.title}
              card={row.card}
              word={row.word}
              time={<DelegationClock agentId={row.agentId} isLive={row.isLive} />}
              isSelected={row.agentId === selectedAgentId}
              fold={
                count === 0
                  ? null
                  : {
                      isExpanded,
                      count,
                      onToggle: () =>
                        setExpanded((current) => ({ ...current, [row.id]: !isExpanded })),
                    }
              }
              onOpen={() =>
                openSpawned({
                  sessionId,
                  target:
                    row.level === 1
                      ? { kind: 'auto-root', agentId: row.agentId }
                      : { kind: 'auto-child', agentId: row.agentId },
                })
              }
            />
          </ObjectMenuArea>
        );
      })}
    </div>
  );
};
