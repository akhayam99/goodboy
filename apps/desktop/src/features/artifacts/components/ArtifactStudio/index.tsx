import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useIsSessionCollectionLoaded,
  useSessionOpenQuestions,
  useSessionPlans,
  agentPlace,
} from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { ArtifactList } from '../ArtifactList';
import { ArtifactShell } from '../ArtifactShell';
import type { ArtifactShellSubject } from '../ArtifactShell/artifactShellSubject';
import { resolveArtifactGenerations } from '../../artifactCollection';
import { askingAgentIdsOf } from '../../../plans/askingAgentIdsOf';
import { useRevisingPlans } from '../../../plans/useRevisingPlans';
import { useNow } from '../../../../shared/hooks/useNow';
import { keepEqualById } from '../../../../shared/utils/keepEqualById';
import {
  buildArtifactListRows,
  countArtifactRows,
  filterArtifactRows,
  type ArtifactListRow,
} from '../../artifactListRows';
import { planAsArtifact, planFromArtifact } from '../../../plans/planAsArtifact';
import { PaneShell, useEscapeLayer } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { GoneObject } from '../../../../shared/components/GoneObject';
import { isTextEntryTarget } from '../../../../shared/keyboard/isTypingTarget';
import { openArtifactPage } from '../../openArtifactPage';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Props = {
  readonly sessionId: SessionId;
};

export const ArtifactStudio = ({ sessionId }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const autoViews = useAppStore((s) => s.autoTreeViews[sessionId] ?? EMPTY_ARRAY);
  const session = useAppStore((s) => sessionById(s.sessions, sessionId) ?? null);
  const runs = session?.workflowRuns ?? (EMPTY_ARRAY as ReadonlyArray<WorkflowRun>);
  const templates = useAppStore(
    (s) =>
      (session === null ? undefined : s.phaseTemplates[session.workspaceId]) ??
      (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const plans = useSessionPlans(sessionId);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const focusedArtifactId = useAppStore((s) => s.focusedArtifactId[sessionId] ?? null);
  const navigate = useAppStore((s) => s.navigate);
  const up = useAppStore((s) => s.up);
  const isShown = useAppStore(
    (s) => s.currentSessionId === sessionId && s.activeLens[sessionId] === 'plans',
  );
  const hasArtifacts = useAppStore((s) => s.sessionArtifacts[sessionId] !== undefined);
  const hasPlans = useIsSessionCollectionLoaded({ sessionId, collection: 'plans' });
  const filter = useAppStore((s) => s.artifactFilter[sessionId] ?? 'all');
  const setArtifactFilter = useAppStore((s) => s.setArtifactFilter);
  const awaitedAgentId = useAppStore((s) => s.awaitedArtifactAgentId[sessionId] ?? null);
  const awaitArtifactAgent = useAppStore((s) => s.awaitArtifactAgent);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const verifications = useAppStore((s) => s.wireframeScoutVerification);
  const isArtifactDrawerOpen = useAppStore((s) => {
    const kind = selectOpenDrawer(s)?.kind ?? null;
    return kind === 'artifact' || kind === 'plan-part';
  });
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

  useEffect(() => {
    void loadSessionArtifacts(sessionId);
  }, [sessionId, loadSessionArtifacts]);

  useEffect(() => {
    if (awaitedAgentId === null) {
      return;
    }
    const arrived = artifacts.find((artifact) => artifact.agentId === awaitedAgentId) ?? null;
    if (arrived === null) {
      return;
    }
    awaitArtifactAgent({ sessionId, agentId: null });
    if (focusedArtifactId === null && selectedAgentId === null) {
      openArtifactPage({ sessionId, artifactId: arrived.id, isArrival: true });
    }
  }, [
    artifacts,
    awaitedAgentId,
    awaitArtifactAgent,
    focusedArtifactId,
    selectedAgentId,
    sessionId,
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
    setFocusedRunAgent({ sessionId, agentId: null });
    if (produced !== null) {
      openArtifactPage({ sessionId, artifactId: produced.id, isArrival: true });
    }
  }, [focusedRunAgentId, generations, artifacts, sessionId, setFocusedRunAgent]);

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

  const askingAgentIds = useMemo(
    () => askingAgentIdsOf({ questions: openQuestions }),
    [openQuestions],
  );
  const now = useNow(60_000);
  const revising = useRevisingPlans(sessionId);
  const rowCache = useRef<ReadonlyMap<string, ArtifactListRow>>(new Map());
  const rows = useMemo(() => {
    const kept = keepEqualById({
      previous: rowCache.current,
      next: buildArtifactListRows({
        plans,
        artifacts,
        generations,
        agents,
        runs,
        templates,
        openQuestionCount: openQuestions.length,
        askingAgentIds,
        revising,
        autoViews,
        now,
      }),
    });
    rowCache.current = new Map(kept.map((row) => [row.id, row]));
    return kept;
  }, [
    plans,
    artifacts,
    generations,
    agents,
    runs,
    templates,
    openQuestions.length,
    askingAgentIds,
    revising,
    autoViews,
    now,
  ]);
  const counts = useMemo(() => countArtifactRows({ rows }), [rows]);
  const visibleRows = useMemo(() => filterArtifactRows({ rows, filter }), [rows, filter]);

  const openRow = useCallback(
    (row: ArtifactListRow) => {
      if (row.target.kind === 'artifact') {
        openArtifactPage({ sessionId, artifactId: row.target.artifactId });
        return;
      }
      const { generation } = row.target;
      if (generation.state === 'unproduced') {
        navigate({ to: agentPlace({ sessionId, agentId: generation.agentId }) });
        return;
      }
      setFocusedRunAgent({ sessionId, agentId: generation.agentId });
    },
    [navigate, sessionId, setFocusedRunAgent],
  );

  useEscapeLayer(
    () => {
      if (isTextEntryTarget(document.activeElement)) {
        return;
      }
      setFocusedRunAgent({ sessionId, agentId: null });
    },
    isShown && selectedAgentId === null && subject?.kind === 'generation' && !isArtifactDrawerOpen,
  );

  if (subject === null && focusedArtifactId !== null && hasArtifacts && hasPlans) {
    return (
      <PaneShell page="artifacts" title="Artifact">
        <GoneObject noun="artifact" icon={CONCEPT_ICONS.plans} onBack={up} />
      </PaneShell>
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
      onImported={(artifactId) => openArtifactPage({ sessionId, artifactId })}
    />
  );
};
