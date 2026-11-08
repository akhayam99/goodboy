import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, OpenQuestion, SessionArtifact } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { resolveArtifactGenerations, type ArtifactGeneration } from '../../artifactCollection';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
};

export const useArtifactGenerationList = ({
  agents,
  artifacts,
  openQuestions,
}: Params): ReadonlyArray<ArtifactGeneration> => {
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

  return useMemo(
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
};
