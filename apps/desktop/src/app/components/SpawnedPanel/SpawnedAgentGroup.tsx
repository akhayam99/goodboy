import { useMemo } from 'react';
import { WorkNode } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../store';
import { DelegationClock } from '../../../features/auto/chat/DelegationClock';
import { classifyAgent } from '../../../features/session/agent-kind';
import { openSpawned } from '../../../features/session/openSpawned';
import { agentStateOf } from '../../../features/workTreeModel/agentStateOf';
import { ObjectMenuArea } from '../../../features/actions/components/ObjectMenuArea';
import { agentLaunchRowOf } from './agentLaunchRowOf';
import { spawnedRailOf } from './spawnedRailOf';
import { SpawnedTreeRow } from './SpawnedTreeRow';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly selectedAgentId: AgentId | null;
};

export const SpawnedAgentGroup = ({ sessionId, agentId, selectedAgentId }: Props) => {
  const agent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? []).find((item) => item.id === agentId) ?? null,
  );
  const override = useAppStore((state) => state.agentKindOverride[agentId] ?? null);
  const turn = useAppStore((state) => state.agentTurnState[agentId]);
  const questions = useSessionOpenQuestions(sessionId);
  const row = useMemo(() => {
    if (agent === null) {
      return null;
    }
    const state = agentStateOf({
      agent,
      turn,
      openQuestions: questions.filter(
        (question) => question.status === 'open' && question.createdByAgentId === agentId,
      ),
    });
    return agentLaunchRowOf({ agent, kind: classifyAgent({ agent, override }), state });
  }, [agent, agentId, override, questions, turn]);
  const rail = useMemo(
    () =>
      spawnedRailOf({
        nodes: [{ id: agentId, level: 1, isPending: row?.node === 'queued' }],
      }),
    [agentId, row?.node],
  );
  const rowRail = rail.railById.get(agentId);
  if (row === null || rowRail === undefined) {
    return null;
  }
  return (
    <div data-spawned-launch="" className="flex min-w-0 flex-col-reverse">
      <ObjectMenuArea
        target={{ kind: 'agent', sessionId, agentId }}
        anchorKey={`spawned:${agentId}`}
      >
        <SpawnedTreeRow
          id={row.id}
          agentId={agentId}
          level={row.level}
          hasChildren={false}
          rail={rowRail}
          railWidth={rail.width}
          glyph={<WorkNode state={row.node} label={row.word} mark={{ kind: 'dot' }} size="sm" />}
          role={row.role}
          title={row.title}
          card={row.card}
          word={row.word}
          time={<DelegationClock agentId={agentId} isLive={row.isLive} />}
          isSelected={agentId === selectedAgentId}
          onOpen={() => openSpawned({ sessionId, target: { kind: 'agent', agentId } })}
        />
      </ObjectMenuArea>
    </div>
  );
};
