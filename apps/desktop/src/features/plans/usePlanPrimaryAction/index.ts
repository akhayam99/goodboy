import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  Agent,
  AgentId,
  ArtifactComment,
  PlanWithCount,
  SessionId,
  Workflow,
  WorkflowRun,
} from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { isRunHeldForPlan } from '../../../store/slices/workflows/workflowPlanApproval';
import { useFollowToast } from '../../../shared/hooks/useFollowToast';
import { markUserStart } from '../../../shared/lib/userStarts';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isPlanHeldByAuto } from '../../auto/isPlanHeldByAuto';
import { afterDraftSaves } from '../planComments/afterDraftSaves';
import { planApprovedFollowOf } from '../planApprovedFollow';
import { planNextStepNameOf } from '../planNextStepNameOf';
import { planPrimaryOf, type PlanPrimary } from '../planPrimaryOf';
import { plannerQuestionsOf } from '../plannerQuestions';
import type { PlanRevising } from '../planRevising';
import { unsentCommentsConfirmOf, type UnsentCommentsConfirm } from '../unsentCommentsConfirmOf';
import { usePlanOwner } from '../usePlanOwner';
import { usePlanRun, usePlanRunToast } from '../usePlanRun';

const NO_COMMENTS: ReadonlyArray<ArtifactComment> = [];
const NO_AGENTS: ReadonlyArray<Agent> = [];
const NO_VIEWS: ReadonlyArray<AutoTreeView> = [];
const NO_TEMPLATES: ReadonlyArray<Workflow> = [];

const NEXT_STEP_NAME = 'The next step';

const APPROVE_FAILED_TITLE = "Couldn't approve the plan";

type Params = Readonly<{
  sessionId: SessionId;
  plan: PlanWithCount;
  revising: PlanRevising;
  isRunning: boolean;
}>;

export type PlanApproveConfirm = Readonly<{
  prompt: UnsentCommentsConfirm;
  confirm: () => Promise<void>;
  cancel: () => void;
}>;

export type PlanPrimaryAction = Readonly<{
  primary: PlanPrimary;
  run: WorkflowRun | null;
  drafts: ReadonlyArray<ArtifactComment>;
  isBusy: boolean;
  isApproving: boolean;
  error: string | null;
  confirm: PlanApproveConfirm | null;
  press: () => void;
}>;

const stepNameOf = ({
  sessionId,
  agentId,
}: {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
}): string | null => {
  if (agentId === null) {
    return null;
  }
  const agents = useAppStore.getState().sessionPhaseRuns[sessionId] ?? NO_AGENTS;
  return agents.find((agent) => agent.id === agentId)?.name ?? NEXT_STEP_NAME;
};

const waitForRender = (): Promise<void> =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });

export const usePlanPrimaryAction = ({
  sessionId,
  plan,
  revising,
  isRunning,
}: Params): PlanPrimaryAction => {
  const comments = useAppStore((state) => state.artifactComments[sessionId]) ?? NO_COMMENTS;
  const openQuestions = useSessionOpenQuestions(sessionId);
  const plannerQuestionCount = plannerQuestionsOf({ questions: openQuestions, plan }).length;
  const approveWorkflowRunPlan = useAppStore((state) => state.approveWorkflowRunPlan);
  const runPlan = useAppStore((state) => state.runPlan);
  const reportError = useAppStore((state) => state.reportError);
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const follow = useFollowToast();
  const announceRun = usePlanRunToast();
  const planRun = usePlanRun({ sessionId, planId: plan.id });
  const [isApproving, setIsApproving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const drafts = useMemo(
    () =>
      comments.filter((comment) => comment.artifactId === plan.id && comment.status === 'draft'),
    [comments, plan.id],
  );
  const run = usePlanOwner({ sessionId, plan });
  const isHeldByAuto = useAppStore((state) =>
    isPlanHeldByAuto({ views: state.autoTreeViews[sessionId] ?? NO_VIEWS, planId: plan.id }),
  );
  const nextStepName = useAppStore((state) => {
    const workspaceId = sessionById(state.sessions, sessionId)?.workspaceId ?? null;
    return planNextStepNameOf({
      run,
      templates:
        workspaceId === null ? NO_TEMPLATES : (state.phaseTemplates[workspaceId] ?? NO_TEMPLATES),
      agents: state.sessionPhaseRuns[sessionId] ?? NO_AGENTS,
    });
  });
  const primary = useMemo(
    () =>
      planPrimaryOf({
        plan,
        run,
        drafts,
        revising,
        isRunning,
        plannerQuestionCount,
        isHeldByAuto,
        nextStepName,
      }),
    [plan, run, drafts, revising, isRunning, plannerQuestionCount, isHeldByAuto, nextStepName],
  );

  const settleApproved = useCallback(
    async ({
      run: approvedRun,
      agentId,
    }: {
      readonly run: WorkflowRun;
      readonly agentId: AgentId | null;
    }) => {
      const state = useAppStore.getState();
      const isOverPlan =
        state.drawer?.kind === 'artifact-document' && state.drawer.payload.artifactId === plan.id;
      if (isOverPlan) {
        closeDrawer();
        await waitForRender();
      }
      follow(
        planApprovedFollowOf({
          sessionId,
          runId: approvedRun.id,
          startedStepName: stepNameOf({ sessionId, agentId }),
        }),
      );
    },
    [closeDrawer, follow, plan.id, sessionId],
  );

  const approveHeld = useCallback(
    async ({ held }: { readonly held: WorkflowRun }) => {
      const result = await approveWorkflowRunPlan(sessionId, held.id);
      if (result.kind === 'failed') {
        await reportError({
          title: APPROVE_FAILED_TITLE,
          error: new Error(result.message),
          sessionId,
        });
        return;
      }
      if (result.kind === 'approved') {
        await settleApproved({
          run: held,
          agentId: result.next === 'started' ? result.agentId : null,
        });
      }
    },
    [approveWorkflowRunPlan, reportError, sessionId, settleApproved],
  );

  const approveThroughRun = useCallback(
    async ({ feeds }: { readonly feeds: WorkflowRun }) => {
      const result = await runPlan(sessionId, plan.id);
      if (result.kind === 'started' && result.scope === 'workflow') {
        await settleApproved({ run: feeds, agentId: result.agentId });
        return;
      }
      announceRun({ result, sessionId });
    },
    [announceRun, plan.id, runPlan, sessionId, settleApproved],
  );

  const approve = useCallback(async () => {
    if (run === null || isApproving) {
      return;
    }
    setIsApproving(true);
    markUserStart({ key: run.id });
    try {
      if (isRunHeldForPlan({ run })) {
        await approveHeld({ held: run });
        return;
      }
      await approveThroughRun({ feeds: run });
    } catch (cause) {
      await reportError({ title: APPROVE_FAILED_TITLE, error: cause, sessionId });
    } finally {
      setIsApproving(false);
    }
  }, [approveHeld, approveThroughRun, isApproving, reportError, run, sessionId]);

  const start = useCallback(async () => {
    if (primary.kind === 'approve') {
      await approve();
      return;
    }
    if (primary.kind === 'run') {
      await planRun.run();
    }
  }, [approve, planRun, primary.kind]);

  const prompt = useMemo(
    () => unsentCommentsConfirmOf({ primary, count: drafts.length }),
    [drafts.length, primary],
  );

  const latest = useRef({ prompt, start });
  latest.current = { prompt, start };

  const press = useCallback(() => {
    afterDraftSaves({
      artifactId: plan.id,
      run: () => {
        if (latest.current.prompt !== null) {
          setIsConfirming(true);
          return;
        }
        void latest.current.start();
      },
      onBlocked: ({ title, message }) => {
        void reportError({ title, error: new Error(message), sessionId });
      },
    });
  }, [plan.id, reportError, sessionId]);

  const confirm = useMemo<PlanApproveConfirm | null>(() => {
    if (!isConfirming || prompt === null) {
      return null;
    }
    return {
      prompt,
      confirm: async () => {
        await start();
        setIsConfirming(false);
      },
      cancel: () => setIsConfirming(false),
    };
  }, [isConfirming, prompt, start]);

  return {
    primary,
    run,
    drafts,
    isBusy: isApproving || planRun.isSpawning,
    isApproving,
    error: planRun.error,
    confirm,
    press,
  };
};
