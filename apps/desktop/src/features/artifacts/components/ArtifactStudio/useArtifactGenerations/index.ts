import { useEffect } from 'react';
import type { Agent, OpenQuestion, SessionArtifact, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useArtifactGenerationList } from '../../../hooks/useArtifactGenerationList';
import { openArtifactPage } from '../../../openArtifactPage';

type Params = {
  readonly sessionId: SessionId;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
};

export const useArtifactGenerations = ({ sessionId, agents, artifacts, openQuestions }: Params) => {
  const generations = useArtifactGenerationList({ agents, artifacts, openQuestions });
  const focusedRunAgentId = useAppStore((s) => s.focusedRunAgentId[sessionId] ?? null);
  const setFocusedRunAgent = useAppStore((s) => s.setFocusedRunAgent);

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
