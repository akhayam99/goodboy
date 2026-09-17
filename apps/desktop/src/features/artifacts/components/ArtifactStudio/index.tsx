import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, ArtifactId, IsoDateTime, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../store';
import { PlanStudio } from '../../../plans/components/PlanStudio';
import { ArtifactCollection } from './ArtifactCollection';
import { ArtifactDetail } from './ArtifactDetail';
import { ArtifactCreationPane } from '../ArtifactCreationPane';
import { loadArtifactProvenance } from '../../artifactProvenance';
import { ARTIFACT_RETRY_MISSING_BRIEF, artifactRetryDraft } from '../../artifactRetryDraft';
import { resolveArtifactGenerations, type ArtifactGeneration } from '../../artifactCollection';

type Props = {
  readonly sessionId: SessionId;
  readonly eyebrow?: ReactNode;
};

export const ArtifactStudio = ({ sessionId, eyebrow }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const session = useAppStore((s) => s.sessions.find((entry) => entry.id === sessionId) ?? null);
  const plans = useSessionPlans(sessionId);
  const openQuestionCount = useSessionOpenQuestions(sessionId).length;
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const focusedPlanId = useAppStore((s) => s.focusedPlanId[sessionId] ?? null);
  const focusedArtifactId = useAppStore((s) => s.focusedArtifactId[sessionId] ?? null);
  const setFocusedArtifactId = useAppStore((s) => s.setFocusedArtifactId);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const filter = useAppStore((s) => s.artifactFilter[sessionId] ?? 'all');
  const setArtifactFilter = useAppStore((s) => s.setArtifactFilter);
  const creation = useAppStore((s) => s.artifactCreation[sessionId] ?? null);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const sessionStudio = useAppStore((s) => s.sessionStudio[sessionId] ?? null);
  const openArtifactCreation = useAppStore((s) => s.openArtifactCreation);
  const closeArtifactCreation = useAppStore((s) => s.closeArtifactCreation);
  const setArtifactDraft = useAppStore((s) => s.setArtifactDraft);
  const stopArtifactGeneration = useAppStore((s) => s.stopArtifactGeneration);
  const verifications = useAppStore((s) => s.wireframeScoutVerification);
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
  const runningAgentIds = useAppStore(
    useShallow((s) =>
      agents.filter((agent) => s.agentTurnState?.[agent.id]?.kind === 'running').map((a) => a.id),
    ),
  );
  const [awaitedAgentId, setAwaitedAgentId] = useState<AgentId | null>(null);

  useEffect(() => {
    void loadSessionArtifacts(sessionId);
  }, [sessionId, loadSessionArtifacts]);

  useEffect(() => {
    setAwaitedAgentId(null);
  }, [sessionId]);

  useEffect(() => {
    if (awaitedAgentId === null) {
      return;
    }
    const arrived = artifacts.find((artifact) => artifact.agentId === awaitedAgentId) ?? null;
    if (arrived === null) {
      return;
    }
    setAwaitedAgentId(null);
    if (
      focusedArtifactId === null &&
      focusedPlanId === null &&
      creation === null &&
      selectedAgentId === null &&
      sessionStudio === null
    ) {
      setFocusedArtifactId(sessionId, arrived.id);
    }
  }, [
    artifacts,
    awaitedAgentId,
    focusedArtifactId,
    focusedPlanId,
    creation,
    selectedAgentId,
    sessionId,
    sessionStudio,
    setFocusedArtifactId,
  ]);

  const generations = useMemo(
    () =>
      resolveArtifactGenerations({
        agents,
        artifacts,
        activeAgentIds: new Set<AgentId>(activeAgentIds),
        runningAgentIds: new Set<AgentId>(runningAgentIds),
        verifications,
      }),
    [agents, artifacts, activeAgentIds, runningAgentIds, verifications],
  );

  const standalone = artifacts.filter((artifact) => artifact.kind !== 'plan');
  const selected = standalone.find((artifact) => artifact.id === focusedArtifactId) ?? null;

  const selectArtifact = (artifactId: ArtifactId) => {
    const target = artifacts.find((artifact) => artifact.id === artifactId) ?? null;
    if (target === null) {
      return;
    }
    if (target.kind === 'plan') {
      setFocusedPlanId(sessionId, target.id);
      return;
    }
    setFocusedArtifactId(sessionId, target.id);
  };

  const retryGeneration = (generation: ArtifactGeneration) => {
    loadArtifactProvenance(generation.agentId)
      .catch(() => null)
      .then((provenance) => {
        const now = new Date().toISOString() as IsoDateTime;
        setArtifactDraft({
          sessionId,
          draft: artifactRetryDraft({ generation, provenance, now }),
        });
        openArtifactCreation({
          sessionId,
          kind: generation.kind,
          workflowRunId: provenance?.sourceWorkflowRunId ?? null,
          note: provenance === null ? ARTIFACT_RETRY_MISSING_BRIEF : null,
        });
      });
  };

  if (creation !== null && session !== null) {
    return (
      <ArtifactCreationPane
        sessionId={sessionId}
        session={session}
        kind={creation.kind}
        note={creation.note}
        count={artifacts.length}
        onClose={() => closeArtifactCreation({ sessionId })}
        onStarted={setAwaitedAgentId}
      />
    );
  }

  if (selected !== null) {
    return (
      <ArtifactDetail
        sessionId={sessionId}
        artifact={selected}
        agents={agents}
        artifacts={artifacts}
        count={artifacts.length}
        onBack={() => setFocusedArtifactId(sessionId, null)}
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
      onStopGeneration={(generation) =>
        void stopArtifactGeneration({ sessionId, agentId: generation.agentId })
      }
      onRetryGeneration={retryGeneration}
    />
  );
};
