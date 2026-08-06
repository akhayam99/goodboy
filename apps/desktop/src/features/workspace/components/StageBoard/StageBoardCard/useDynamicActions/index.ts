import { useEffect, useMemo, useState } from 'react';
import { Check, HelpCircle, MessageSquare, Play, SkipForward, type LucideIcon } from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import type {
  Agent,
  OpenQuestion,
  Session,
  SessionId,
  SessionStageInfo,
  Workflow,
  WorkflowRunId,
} from '@goodboy/types';
import { useAppStore, useSessionHasUnread } from '../../../../../../store';
import { resolveWorkflowAdvance } from '../../../../../workflows/advanceGate';
import {
  viewWorkflowAdvance,
  type WorkflowAdvanceView,
} from '../../../../../workflows/workflowAdvanceView';
import { workflowRunHasOpenQuestions } from '../../../../../context/openQuestionsGate';
import type { BoardNavigation } from '../../useBoardNavigation';

export type DynamicAction = {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly tone: Extract<Tone, 'primary' | 'warning' | 'danger'>;
  readonly label: string;
  readonly onClick: () => void;
};

type RunAdvance = {
  readonly runId: WorkflowRunId;
  readonly view: WorkflowAdvanceView;
};

const EMPTY_QUESTIONS: ReadonlyArray<OpenQuestion> = [];
const EMPTY_WORKFLOWS: ReadonlyArray<Workflow> = [];
const EMPTY_RUNS: ReadonlyArray<Agent> = [];

export const useDynamicActions = (
  session: Session,
  nav: BoardNavigation,
  stage: SessionStageInfo['stage'],
): ReadonlyArray<DynamicAction> => {
  const id = session.id as SessionId;
  const openQuestions = useAppStore((s) => s.sessionOpenQuestions[id] ?? EMPTY_QUESTIONS);
  const workflows = useAppStore((s) => s.sessionWorkflows[id] ?? EMPTY_WORKFLOWS);
  const runs = useAppStore((s) => s.sessionPhaseRuns[id] ?? EMPTY_RUNS);
  const isSummarizerRunning = useAppStore((s) => s.summarizerStatus[id]?.status === 'running');
  const skipStuckStepAndAdvance = useAppStore((s) => s.skipStuckStepAndAdvance);
  const hasUnread = useSessionHasUnread(id);
  const [isConfirmingSkip, setIsConfirmingSkip] = useState(false);

  const advances = useMemo(() => {
    const out: Array<RunAdvance> = [];
    for (const run of session.workflowRuns) {
      if (run.discardedAt) {
        continue;
      }
      const workflow = workflows.find((w) => w.id === run.workflowId);
      if (!workflow) {
        continue;
      }
      out.push({
        runId: run.id,
        view: viewWorkflowAdvance({
          state: resolveWorkflowAdvance({
            workflow,
            agents: runs.filter((agent) => agent.workflowRunId === run.id),
            hasOpenQuestions: workflowRunHasOpenQuestions(openQuestions, run.id),
            isSummarizerRunning,
            isTurnRunning: false,
            isAutoRun: run.autoRun,
          }),
        }),
      });
    }
    return out;
  }, [session.workflowRuns, workflows, runs, openQuestions, isSummarizerRunning]);

  const blocked = advances.find((advance) => advance.view.failedStep != null) ?? null;
  const blockedRunId = blocked?.runId ?? null;
  const blockedStepName = blocked?.view.failedStep?.name ?? null;

  useEffect(() => {
    if (blockedRunId != null) {
      return;
    }
    setIsConfirmingSkip(false);
  }, [blockedRunId]);

  return useMemo(() => {
    const openCount = openQuestions.filter((q) => q.status === 'open').length;
    const nextStepReady =
      stage !== 'running' && advances.some((advance) => advance.view.manualStep != null);

    const actions: DynamicAction[] = [];
    if (blockedRunId != null && isConfirmingSkip) {
      actions.push({
        key: 'blocked',
        icon: Check,
        tone: 'danger',
        label: 'Confirm skip and continue',
        onClick: () => {
          setIsConfirmingSkip(false);
          void skipStuckStepAndAdvance(id, blockedRunId, { onlyWhenBlocked: true });
        },
      });
    }
    if (blockedRunId != null && !isConfirmingSkip) {
      actions.push({
        key: 'blocked',
        icon: SkipForward,
        tone: 'warning',
        label:
          blockedStepName != null
            ? `Skip blocked step: ${blockedStepName}`
            : 'Skip the blocked step',
        onClick: () => setIsConfirmingSkip(true),
      });
    }
    if (nextStepReady) {
      actions.push({
        key: 'run',
        icon: Play,
        tone: 'primary',
        label: 'run next step',
        onClick: () => nav.openWorkflows(session),
      });
    }
    if (openCount > 0) {
      actions.push({
        key: 'questions',
        icon: HelpCircle,
        tone: 'warning',
        label: openCount === 1 ? '1 open question' : `${openCount} open questions`,
        onClick: () => nav.openQuestions(session),
      });
    }
    if (hasUnread) {
      actions.push({
        key: 'unread',
        icon: MessageSquare,
        tone: 'primary',
        label: 'unread reply',
        onClick: () => nav.openAgent(session),
      });
    }
    return actions;
  }, [
    session,
    nav,
    stage,
    openQuestions,
    hasUnread,
    advances,
    blockedRunId,
    blockedStepName,
    isConfirmingSkip,
    skipStuckStepAndAdvance,
    id,
  ]);
};
