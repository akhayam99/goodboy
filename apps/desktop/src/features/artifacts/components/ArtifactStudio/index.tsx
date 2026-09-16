import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, ArtifactId, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../store';
import { PlanStudio } from '../../../plans/components/PlanStudio';
import { ArtifactCollection } from './ArtifactCollection';
import { ArtifactDetail } from './ArtifactDetail';
import { resolveArtifactGenerations } from '../../artifactCollection';

type Props = {
  readonly sessionId: SessionId;
  readonly eyebrow?: ReactNode;
};

export const ArtifactStudio = ({ sessionId, eyebrow }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const plans = useSessionPlans(sessionId);
  const openQuestionCount = useSessionOpenQuestions(sessionId).length;
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const focusedPlanId = useAppStore((s) => s.focusedPlanId[sessionId] ?? null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const filter = useAppStore((s) => s.artifactFilter[sessionId] ?? 'all');
  const setArtifactFilter = useAppStore((s) => s.setArtifactFilter);
  const activeAgentIds = useAppStore(
    useShallow((s) =>
      agents
        .filter((agent) => {
          const turn = s.agentTurnState?.[agent.id];
          return turn?.kind === 'running' || turn?.kind === 'starting';
        })
        .map((agent) => agent.id),
    ),
  );
  const [focusedArtifactId, setFocusedArtifactId] = useState<ArtifactId | null>(null);

  useEffect(() => {
    void loadSessionArtifacts(sessionId);
  }, [sessionId, loadSessionArtifacts]);

  useEffect(() => {
    setFocusedArtifactId(null);
  }, [sessionId]);

  const generations = useMemo(
    () =>
      resolveArtifactGenerations({
        agents,
        artifacts,
        activeAgentIds: new Set<AgentId>(activeAgentIds),
      }),
    [agents, artifacts, activeAgentIds],
  );

  const standalone = artifacts.filter((artifact) => artifact.kind !== 'plan');
  const selected = standalone.find((artifact) => artifact.id === focusedArtifactId) ?? null;

  const selectArtifact = (artifactId: ArtifactId) => {
    const target = artifacts.find((artifact) => artifact.id === artifactId) ?? null;
    if (target === null) {
      return;
    }
    if (target.kind === 'plan') {
      setFocusedArtifactId(null);
      setFocusedPlanId(sessionId, target.id);
      return;
    }
    setFocusedPlanId(sessionId, null);
    setFocusedArtifactId(target.id);
  };

  if (selected !== null) {
    return (
      <ArtifactDetail
        sessionId={sessionId}
        artifact={selected}
        agents={agents}
        artifacts={artifacts}
        count={artifacts.length}
        onBack={() => setFocusedArtifactId(null)}
        onSelectArtifact={selectArtifact}
      />
    );
  }

  if (focusedPlanId !== null) {
    return <PlanStudio sessionId={sessionId} eyebrow={eyebrow} />;
  }

  return (
    <ArtifactCollection
      plans={plans}
      artifacts={standalone}
      generations={generations}
      openQuestionCount={openQuestionCount}
      filter={filter}
      eyebrow={eyebrow}
      onFilterChange={(next) => setArtifactFilter({ sessionId, filter: next })}
      onSelectPlan={(planId) => setFocusedPlanId(sessionId, planId)}
      onSelectArtifact={selectArtifact}
      onSelectGeneration={(agentId) => void selectAgent(sessionId, agentId)}
    />
  );
};
