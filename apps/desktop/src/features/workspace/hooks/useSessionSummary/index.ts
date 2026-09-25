import { useMemo } from 'react';
import type {
  Agent,
  PrReviewDraft,
  PullRequestStateKind,
  Session,
  SessionAttentionReason,
  SessionExternalTask,
  SessionId,
  SessionStage,
} from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import {
  EMPTY_ARRAY,
  useAppStore,
  useNonResolverStandaloneAgents,
  useSessionCost,
  useSessionStageInfo,
} from '../../../../store';
import { describeSessionStage } from '../../../session/session-stage';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { workflowProgress, type WorkflowProgress } from './workflowProgress';
import { summaryMeta, type SummaryActionable, type SummaryMetaItem } from './summaryMeta';

export type SessionSummary = {
  readonly stage: SessionStage;
  readonly attention: SessionAttentionReason | null;
  readonly tone: Tone;
  readonly reason: string;
  readonly description: string;
  readonly prState: PullRequestStateKind | null;
  readonly progress: WorkflowProgress | null;
  readonly actionable: SummaryActionable | null;
  readonly tasks: ReadonlyArray<SessionExternalTask>;
  readonly meta: ReadonlyArray<SummaryMetaItem>;
  readonly agentCount: number;
  readonly isAutorun: boolean;
  readonly cost: number;
  readonly age: string;
};

type Params = {
  readonly session: Session;
};

export const useSessionSummary = ({ session }: Params): SessionSummary => {
  const id = session.id as SessionId;
  const stageInfo = useSessionStageInfo(session);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const runs = useAttachedWorkflowRuns({ session });
  const openQuestionCount = useAppStore(
    (s) => (s.sessionOpenQuestions[id] ?? EMPTY_ARRAY).filter((q) => q.status === 'open').length,
  );
  const draftCount = useAppStore(
    (s) =>
      (s.reviewDrafts[id] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>)).filter(
        (draft) => draft.status === 'draft',
      ).length,
  );
  const tasks = useAppStore(
    (s) => s.sessionExternalTasks[id] ?? (EMPTY_ARRAY as ReadonlyArray<SessionExternalTask>),
  );
  const agentCount = useNonResolverStandaloneAgents(id).length;
  const cost = useSessionCost(id);

  const progress = useMemo(() => workflowProgress({ runs, agents: phaseRuns }), [runs, phaseRuns]);
  const actionable = useMemo((): SummaryActionable | null => {
    if (openQuestionCount > 0) {
      return { kind: 'questions', count: openQuestionCount };
    }
    if (draftCount > 0) {
      return { kind: 'drafts', count: draftCount };
    }
    return null;
  }, [openQuestionCount, draftCount]);
  const meta = useMemo(
    () => summaryMeta({ actionable, tasks, agentCount }),
    [actionable, tasks, agentCount],
  );

  const presentation = describeSessionStage(stageInfo);
  const isAutorun =
    stageInfo.stage === 'running' &&
    session.workflowRuns.some((run) => run.autoRun && run.discardedAt == null);

  return {
    stage: stageInfo.stage,
    attention: stageInfo.attention,
    tone: presentation.tone,
    reason: stageInfo.reason,
    description: stateDescription({ presentation }),
    prState: stageInfo.prState,
    progress,
    actionable,
    tasks,
    meta,
    agentCount,
    isAutorun,
    cost,
    age: formatRelativeAge({ fromIso: session.updatedAt }),
  };
};
