import { useMemo, useRef } from 'react';
import type { Agent, SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { useNow } from '../../../../shared/hooks/useNow';
import { keepEqualById } from '../../../../shared/utils/keepEqualById';
import { askingAgentIdsOf } from '../../../plans/askingAgentIdsOf';
import { useRevisingPlans } from '../../../plans/useRevisingPlans';
import type { ArtifactGeneration } from '../../artifactCollection';
import { buildArtifactListRows, type ArtifactListRow } from '../../artifactListRows';

type Params = {
  readonly sessionId: SessionId;
  readonly generations: ReadonlyArray<ArtifactGeneration>;
};

export const useArtifactRows = ({
  sessionId,
  generations,
}: Params): ReadonlyArray<ArtifactListRow> => {
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
  const askingAgentIds = useMemo(
    () => askingAgentIdsOf({ questions: openQuestions }),
    [openQuestions],
  );
  const now = useNow(60_000);
  const revising = useRevisingPlans(sessionId);
  const rowCache = useRef<ReadonlyMap<string, ArtifactListRow>>(new Map());
  return useMemo(() => {
    const kept = keepEqualById({
      previous: rowCache.current,
      next: buildArtifactListRows({
        plans,
        artifacts,
        generations,
        agents,
        runs,
        templates,
        openQuestions,
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
    openQuestions,
    askingAgentIds,
    revising,
    autoViews,
    now,
  ]);
};
