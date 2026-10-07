import { useCallback, useMemo, useState } from 'react';
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
import { planApprovedFollowOf } from '../planApprovedFollow';
import { planPrimaryOf, type PlanPrimary } from '../planPrimaryOf';
import { plannerQuestionsOf } from '../plannerQuestions';
import { planRunOf } from '../planRunOf';
import type { PlanRevising } from '../planRevising';
import { usePlanRun, usePlanRunToast } from '../usePlanRun';

const NO_COMMENTS: ReadonlyArray<ArtifactComment> = [];
const NO_AGENTS: ReadonlyArray<Agent> = [];
const NO_RUNS: ReadonlyArray<WorkflowRun> = [];
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
  count: number;
  confirm: () => Promise<void>;
  cancel: () => void;
}>;

export type PlanPrimaryAction = Readonly<{
  primary: PlanPrimary;
  run: WorkflowRun | null;
  drafts: ReadonlyArray<ArtifactComment>;
  isBusy: boolean;
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
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId]) ?? NO_AGENTS;
  const templates =
    useAppStore((state) =>
      session === null ? undefined : state.phaseTemplates[session.workspaceId],
    ) ?? NO_TEMPLATES;
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
  const run = useMemo(
    () =>
      planRunOf({
        plan,
        agents,
        runs: session?.workflowRuns ?? NO_RUNS,
        templates,
      }),
    [plan, agents, session, templates],
  );
  const primary = useMemo(
    () => planPrimaryOf({ plan, run, drafts, revising, isRunning, plannerQuestionCount }),
    [plan, run, drafts, revising, isRunning, plannerQuestionCount],
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
      const isOverRunPage =
        state.currentSessionId === sessionId &&
        state.activeLens[sessionId] === 'workflows' &&
        state.focusedWorkflowRunId[sessionId] === approvedRun.id &&
        state.drawer?.kind === 'artifact-document' &&
        state.drawer.payload.artifactId === plan.id;
      if (isOverRunPage) {
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

  const press = useCallback(() => {
    if (primary.kind === 'approve') {
      if (drafts.length > 0) {
        setIsConfirming(true);
        return;
      }
      void approve();
      return;
    }
    if (primary.kind === 'run') {
      void planRun.run();
    }
  }, [approve, drafts.length, planRun, primary.kind]);

  const confirm = useMemo<PlanApproveConfirm | null>(() => {
    if (!isConfirming || primary.kind !== 'approve' || drafts.length === 0) {
      return null;
    }
    return {
      count: drafts.length,
      confirm: async () => {
        await approve();
        setIsConfirming(false);
      },
      cancel: () => setIsConfirming(false),
    };
  }, [approve, drafts.length, isConfirming, primary.kind]);

  return {
    primary,
    run,
    drafts,
    isBusy: isApproving || planRun.isSpawning,
    error: planRun.error,
    confirm,
    press,
  };
};
