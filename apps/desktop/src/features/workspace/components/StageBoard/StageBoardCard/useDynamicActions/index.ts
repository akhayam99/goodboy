import { useMemo } from 'react';
import { HelpCircle, MessageSquare, Play, type LucideIcon } from 'lucide-react';
import type {
  Agent,
  OpenQuestion,
  Session,
  SessionId,
  SessionStageInfo,
  Workflow,
} from '@goodboy/types';
import { useAppStore, useSessionHasUnread } from '../../../../../../store';
import { pickNextWorkflowStep } from '../../../../../workflows/components/WorkflowNextStepCta';
import { workflowRunHasOpenQuestions } from '../../../../../context/openQuestionsGate';
import type { BoardNavigation } from '../../useBoardNavigation';

export type DynamicAction = {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly color: string;
  readonly label: string;
  readonly onClick: () => void;
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
  const hasUnread = useSessionHasUnread(id);

  return useMemo(() => {
    const openCount = openQuestions.filter((q) => q.status === 'open').length;
    const nextStepReady =
      stage !== 'running' &&
      session.workflowRuns.some((run) => {
        if (run.discardedAt) {
          return false;
        }
        const wf = workflows.find((w) => w.id === run.workflowId);
        if (!wf) {
          return false;
        }
        const runAgents = runs.filter((a) => a.workflowRunId === run.id);
        return (
          pickNextWorkflowStep(wf, runAgents, {
            hasOpenQuestions: workflowRunHasOpenQuestions(openQuestions, run.id),
          }) != null
        );
      });

    const actions: DynamicAction[] = [];
    if (nextStepReady) {
      actions.push({
        key: 'run',
        icon: Play,
        color: 'text-primary',
        label: 'run next step',
        onClick: () => nav.openWorkflows(session),
      });
    }
    if (openCount > 0) {
      actions.push({
        key: 'questions',
        icon: HelpCircle,
        color: 'text-warning',
        label: openCount === 1 ? '1 open question' : `${openCount} open questions`,
        onClick: () => nav.openQuestions(session),
      });
    }
    if (hasUnread) {
      actions.push({
        key: 'unread',
        icon: MessageSquare,
        color: 'text-primary',
        label: 'unread reply',
        onClick: () => nav.openAgent(session),
      });
    }
    return actions;
  }, [session, nav, stage, openQuestions, workflows, runs, hasUnread]);
};
