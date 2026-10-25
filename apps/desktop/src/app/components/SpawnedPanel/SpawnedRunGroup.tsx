import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { WorkNode } from '@goodboy/ui';
import type { AgentId, Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { DelegationClock } from '../../../features/auto/chat/DelegationClock';
import type { AgentKind } from '../../../features/session/agent-kind';
import { useFoldedRunTree } from '../../../features/workflows/components/RunTree/useFoldedRunTree';
import { useRunTree } from '../../../features/workflows/components/RunTree/useRunTree';
import { openSpawned } from '../../../features/session/openSpawned';
import { runSpawnedRowsOf } from './runSpawnedRowsOf';
import { SpawnedFoldRow } from './SpawnedFoldRow';
import { spawnedRailOf } from './spawnedRailOf';
import { SpawnedRunHead } from './SpawnedRunHead';
import { ObjectMenuArea } from '../../../features/actions/components/ObjectMenuArea';
import { SpawnedTreeRow } from './SpawnedTreeRow';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly isHeaded: boolean;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedRunGroup = ({ session, run, workflow, isHeaded, selectedAgentId }: Props) => {
  const sessionId = session.id;
  const agentKindOverride = useAppStore(
    useShallow((state) => {
      const overrides: Record<string, AgentKind> = {};
      for (const agent of state.sessionPhaseRuns[sessionId] ?? []) {
        const kind = state.agentKindOverride[agent.id];
        if (kind !== undefined) {
          overrides[agent.id] = kind;
        }
      }
      return overrides;
    }),
  );
  const tree = useRunTree({ session, run, workflow, agentKindOverride });
  const folded = useFoldedRunTree({ tree });
  const entries = useMemo(
    () =>
      runSpawnedRowsOf({
        items: folded?.tree.stream.items ?? [],
        baseLevel: isHeaded ? 2 : 1,
      }),
    [folded, isHeaded],
  );
  const onSet = folded?.folds.onSet ?? null;
  const headId = `run:${run.id}`;
  const rail = useMemo(
    () =>
      spawnedRailOf({
        nodes: [
          ...(isHeaded ? [{ id: headId, level: 1, isPending: false }] : []),
          ...entries.map((entry) =>
            entry.kind === 'fold'
              ? { id: entry.fold.id, level: entry.fold.level, isPending: false }
              : {
                  id: entry.row.id,
                  level: entry.row.level,
                  isPending: entry.row.node === 'queued',
                },
          ),
        ],
      }),
    [entries, headId, isHeaded],
  );
  const headRail = rail.railById.get(headId);
  return (
    <div data-spawned-launch="" className="flex min-w-0 flex-col-reverse">
      {isHeaded && headRail !== undefined ? (
        <SpawnedRunHead
          session={session}
          run={run}
          workflow={workflow}
          hasChildren={entries.length > 0}
          rail={headRail}
          railWidth={rail.width}
        />
      ) : null}
      {entries.map((entry) => {
        if (entry.kind === 'fold') {
          const foldRail = rail.railById.get(entry.fold.id);
          return onSet === null || foldRail === undefined ? null : (
            <SpawnedFoldRow
              key={entry.fold.id}
              fold={entry.fold}
              rail={foldRail}
              railWidth={rail.width}
              onSet={onSet}
            />
          );
        }
        const { row } = entry;
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
              agentId={row.agentId}
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
              onOpen={() =>
                openSpawned({ sessionId, target: { kind: 'agent', agentId: row.agentId } })
              }
            />
          </ObjectMenuArea>
        );
      })}
    </div>
  );
};
