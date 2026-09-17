import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, ArtifactScoutPlanEntry, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { wireframeScoutProgress } from '../../wireframes/wireframeScoutProgress';
import { artifactMountOptionsKey, selectArtifactMountOptions } from '../artifactMountChoice';
import { loadArtifactProvenance } from '../artifactProvenance';
import { artifactScoutRoster, type ArtifactScoutRow } from '../artifactScoutRoster';

const NO_PLAN = EMPTY_ARRAY as ReadonlyArray<ArtifactScoutPlanEntry>;

export type ArtifactScoutRosterHandle = Readonly<{
  rows: ReadonlyArray<ArtifactScoutRow>;
  isLoaded: boolean;
}>;

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

export const useArtifactScoutRoster = ({
  sessionId,
  agentId,
}: Params): ArtifactScoutRosterHandle => {
  const [plan, setPlan] = useState<ReadonlyArray<ArtifactScoutPlanEntry>>(NO_PLAN);
  const [isLoaded, setIsLoaded] = useState(false);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const runningAgentIds = useAppStore(
    useShallow((s) =>
      agents
        .filter((agent) => s.agentTurnState?.[agent.id]?.kind === 'running')
        .map((agent) => agent.id),
    ),
  );
  const verifications = useAppStore((s) => s.wireframeScoutVerification);
  const mountKey = useAppStore((s) => artifactMountOptionsKey({ state: s, sessionId }));
  const mounts = useMemo(
    () => selectArtifactMountOptions({ state: useAppStore.getState(), sessionId }),
    [mountKey, sessionId],
  );

  useEffect(() => {
    let isCurrent = true;
    setPlan(NO_PLAN);
    setIsLoaded(false);
    loadArtifactProvenance(agentId)
      .then((provenance) => {
        if (!isCurrent) {
          return;
        }
        setPlan(provenance?.scoutPlan ?? NO_PLAN);
        setIsLoaded(true);
      })
      .catch(() => {
        if (isCurrent) {
          setIsLoaded(true);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [agentId]);

  const container = agents.find((agent) => agent.id === agentId) ?? null;
  const progress = useMemo(
    () =>
      container === null
        ? []
        : wireframeScoutProgress({
            container,
            agents,
            runningAgentIds: new Set<AgentId>(runningAgentIds),
            verifications,
          }),
    [container, agents, runningAgentIds, verifications],
  );
  const rows = useMemo(
    () => artifactScoutRoster({ plan, progress, mounts }),
    [plan, progress, mounts],
  );

  return { rows, isLoaded };
};
