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
import { SpawnedRunHead } from './SpawnedRunHead';
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
  return (
    <>
      {isHeaded ? (
        <SpawnedRunHead
          session={session}
          run={run}
          workflow={workflow}
          hasChildren={entries.length > 0}
        />
      ) : null}
      {entries.map((entry) => {
        if (entry.kind === 'fold') {
          return onSet === null ? null : (
            <SpawnedFoldRow key={entry.fold.id} fold={entry.fold} onSet={onSet} />
          );
        }
        const { row } = entry;
        return (
          <SpawnedTreeRow
            key={row.id}
            id={row.id}
            level={row.level}
            hasChildren={row.hasChildren}
            glyph={<WorkNode state={row.node} label={row.word} mark={{ kind: 'dot' }} size="sm" />}
            role={row.role}
            title={row.title}
            detail={row.detail}
            word={row.word}
            time={<DelegationClock agentId={row.agentId} isLive={row.isLive} />}
            isSelected={row.agentId === selectedAgentId}
            onOpen={() =>
              openSpawned({
                sessionId,
                target: { kind: 'run-agent', runId: run.id, agentId: row.agentId },
              })
            }
          />
        );
      })}
    </>
  );
};
