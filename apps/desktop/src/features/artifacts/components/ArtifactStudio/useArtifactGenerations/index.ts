import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, OpenQuestion, SessionArtifact, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { resolveArtifactGenerations } from '../../../artifactCollection';
import { openArtifactPage } from '../../../openArtifactPage';

type Params = {
  readonly sessionId: SessionId;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
};

export const useArtifactGenerations = ({ sessionId, agents, artifacts, openQuestions }: Params) => {
  const verificationList = useAppStore(
    useShallow((s) => agents.map((agent) => s.wireframeScoutVerification[agent.id])),
  );
  const verifications = useMemo(
    () =>
      Object.fromEntries(
        agents.flatMap((agent, index) => {
          const verification = verificationList[index];
          return verification === undefined ? [] : [[agent.id, verification] as const];
        }),
      ),
    [agents, verificationList],
  );
  const turnKinds = useAppStore(
    useShallow((s) => agents.map((agent) => s.agentTurnState[agent.id]?.kind ?? null)),
  );
  const { activeAgentIds, runningAgentIds } = useMemo(() => {
    const active = new Set<AgentId>();
    const running = new Set<AgentId>();
    agents.forEach((agent, index) => {
      const kind = turnKinds[index] ?? null;
      if (kind === 'running') {
        running.add(agent.id);
      }
      if (kind === 'running' || kind === 'starting') {
        active.add(agent.id);
      }
    });
    return { activeAgentIds: active, runningAgentIds: running };
  }, [agents, turnKinds]);
  const focusedRunAgentId = useAppStore((s) => s.focusedRunAgentId[sessionId] ?? null);
  const setFocusedRunAgent = useAppStore((s) => s.setFocusedRunAgent);

  const generations = useMemo(
    () =>
      resolveArtifactGenerations({
        agents,
        artifacts,
        activeAgentIds,
        runningAgentIds,
        openQuestions,
        verifications,
      }),
    [agents, artifacts, activeAgentIds, runningAgentIds, openQuestions, verifications],
  );

  const focusedRun =
    generations.find((generation) => generation.agentId === focusedRunAgentId) ?? null;

  useEffect(() => {
    if (
      focusedRunAgentId === null ||
      generations.some((generation) => generation.agentId === focusedRunAgentId)
    ) {
      return;
    }
    const produced = artifacts.find((artifact) => artifact.agentId === focusedRunAgentId) ?? null;
    setFocusedRunAgent({ sessionId, agentId: null });
    if (produced !== null) {
      openArtifactPage({ sessionId, artifactId: produced.id, isArrival: true });
    }
  }, [focusedRunAgentId, generations, artifacts, sessionId, setFocusedRunAgent]);

  return { generations, focusedRun };
};
