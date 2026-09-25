import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { ArtifactCreationPane } from '../ArtifactCreationPane';
import { ArtifactList } from '../ArtifactList';
import { ArtifactShell } from '../ArtifactShell';
import type { ArtifactShellSubject } from '../ArtifactShell/artifactShellSubject';
import { loadArtifactProvenance } from '../../artifactProvenance';
import { ARTIFACT_RETRY_MISSING_BRIEF, artifactRetryDraft } from '../../artifactRetryDraft';
import { resolveArtifactGenerations, type ArtifactGeneration } from '../../artifactCollection';
import {
  buildArtifactListRows,
  countArtifactRows,
  filterArtifactRows,
  type ArtifactListRow,
} from '../../artifactListRows';
import { planAsArtifact, planFromArtifact } from '../../../plans/planAsArtifact';
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
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
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
  const isArtifactDrawerOpen = useAppStore((s) => selectOpenDrawer(s)?.kind === 'artifact');
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
    if (produced !== null) {
      setFocusedArtifactId(sessionId, produced.id);
    }
  }, [focusedRunAgentId, generations, artifacts, sessionId, setFocusedArtifactId]);

  const subject = useMemo((): ArtifactShellSubject | null => {
    if (focusedArtifactId !== null) {
      const plan = plans.find((candidate) => candidate.id === focusedArtifactId) ?? null;
      const stored = artifacts.find((candidate) => candidate.id === focusedArtifactId) ?? null;
      if (plan !== null) {
        return { kind: 'plan', plan, artifact: planAsArtifact({ plan, stored }) };
      }
      if (stored?.kind === 'plan') {
        return { kind: 'plan', plan: planFromArtifact({ artifact: stored }), artifact: stored };
      }
      if (stored?.kind === 'report') {
        return { kind: 'report', artifact: stored };
      }
      if (stored?.kind === 'wireframe') {
        return { kind: 'wireframe', artifact: stored };
      }
    }
    return focusedRun === null ? null : { kind: 'generation', generation: focusedRun };
  }, [focusedArtifactId, plans, artifacts, focusedRun]);

  const rows = useMemo(
    () =>
      buildArtifactListRows({
        plans,
        artifacts,
        generations,
        agents,
        openQuestionCount: openQuestions.length,
      }),
    [plans, artifacts, generations, agents, openQuestions.length],
  );
  const counts = useMemo(() => countArtifactRows({ rows }), [rows]);
  const visibleRows = useMemo(() => filterArtifactRows({ rows, filter }), [rows, filter]);

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

  const openRow = (row: ArtifactListRow) => {
    if (row.target.kind === 'artifact') {
      setFocusedArtifactId(sessionId, row.target.artifactId);
      return;
    }
    const { generation } = row.target;
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
    isActive: creation === null && subject !== null && !isArtifactDrawerOpen,
    onEscape: backToList,
  });

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

  if (subject !== null) {
    const key = subject.kind === 'generation' ? subject.generation.agentId : subject.artifact.id;
    return <ArtifactShell key={key} sessionId={sessionId} subject={subject} agents={agents} />;
  }

  return (
    <ArtifactList
      sessionId={sessionId}
      rows={visibleRows}
      counts={counts}
      filter={filter}
      onFilterChange={(next) => setArtifactFilter({ sessionId, filter: next })}
      onOpen={openRow}
      onStop={stopGeneration}
      onRetry={retryGeneration}
    />
  );
};
