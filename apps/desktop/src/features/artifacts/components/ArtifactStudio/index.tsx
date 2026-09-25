import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { ArtifactRunDetail } from './ArtifactRunDetail';
import { ArtifactCreationPane } from '../ArtifactCreationPane';
import { loadArtifactProvenance } from '../../artifactProvenance';
import { ARTIFACT_RETRY_MISSING_BRIEF, artifactRetryDraft } from '../../artifactRetryDraft';
import { resolveArtifactGenerations, type ArtifactGeneration } from '../../artifactCollection';
import { standaloneArtifacts } from '../../standaloneArtifacts';
import { artifactCounts, artifactGroups } from '../../artifactGroups';
import { useEscapeToList } from '../../hooks/useEscapeToList';

type Props = {
  readonly sessionId: SessionId;
};

export const ArtifactStudio = ({ sessionId }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const session = useAppStore((s) => s.sessions.find((entry) => entry.id === sessionId) ?? null);
  const plans = useSessionPlans(sessionId);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const openQuestionCount = openQuestions.length;
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
  const [awaitedAgentId, setAwaitedAgentId] = useState<AgentId | null>(null);
  const [focusedRunAgentId, setFocusedRunAgentId] = useState<AgentId | null>(null);

  useEffect(() => {
    void loadSessionArtifacts(sessionId);
  }, [sessionId, loadSessionArtifacts]);

  useEffect(() => {
    setAwaitedAgentId(null);
    setFocusedRunAgentId(null);
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
        activeAgentIds,
        runningAgentIds,
        openQuestions,
        verifications,
      }),
    [agents, artifacts, activeAgentIds, runningAgentIds, openQuestions, verifications],
  );

  const standalone = standaloneArtifacts({ artifacts });
  const selected = standalone.find((artifact) => artifact.id === focusedArtifactId) ?? null;
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
    setFocusedRunAgentId(null);
    if (produced !== null && produced.kind !== 'plan') {
      setFocusedArtifactId(sessionId, produced.id);
    }
  }, [focusedRunAgentId, generations, artifacts, sessionId, setFocusedArtifactId]);

  const groups = useMemo(
    () => artifactGroups({ artifacts: standalone, generations }),
    [standalone, generations],
  );
  const counts = useMemo(() => artifactCounts({ plans, groups }), [plans, groups]);

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

  const selectGeneration = (generation: ArtifactGeneration) => {
    if (generation.state === 'unproduced') {
      void selectAgent(sessionId, generation.agentId);
      return;
    }
    if (focusedArtifactId !== null) {
      setFocusedArtifactId(sessionId, null);
    }
    setFocusedRunAgentId(generation.agentId);
  };

  const stopGeneration = (generation: ArtifactGeneration) => {
    void stopArtifactGeneration({ sessionId, agentId: generation.agentId });
  };

  const backToList = useCallback(() => {
    setFocusedRunAgentId(null);
    setFocusedArtifactId(sessionId, null);
  }, [sessionId, setFocusedArtifactId]);

  useEscapeToList({
    isActive:
      creation === null && focusedPlanId === null && (selected !== null || focusedRun !== null),
    onEscape: backToList,
  });

  const changeFilter = (next: typeof filter) => setArtifactFilter({ sessionId, filter: next });

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

  if (focusedPlanId !== null) {
    return <PlanStudio sessionId={sessionId} />;
  }

  if (selected === null && focusedRun === null) {
    return (
      <ArtifactCollection
        sessionId={sessionId}
        plans={plans}
        groups={groups}
        counts={counts}
        openQuestionCount={openQuestionCount}
        filter={filter}
        onFilterChange={changeFilter}
        onSelectPlan={(planId) => setFocusedPlanId(sessionId, planId)}
        onSelectArtifact={selectArtifact}
        onSelectGeneration={selectGeneration}
        onStopGeneration={stopGeneration}
        onRetryGeneration={retryGeneration}
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
        onBack={() => setFocusedArtifactId(sessionId, null)}
        onSelectArtifact={selectArtifact}
      />
    );
  }

  return focusedRun === null ? null : (
    <ArtifactRunDetail
      sessionId={sessionId}
      generation={focusedRun}
      onBack={() => setFocusedRunAgentId(null)}
      onStop={() => stopGeneration(focusedRun)}
      onOpenAgent={() => void selectAgent(sessionId, focusedRun.agentId)}
    />
  );
};
