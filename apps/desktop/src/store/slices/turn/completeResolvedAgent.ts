import {
  captureArtifactFromTurnText,
  extractFanOut,
  extractReviewComments,
  extractStepDone,
  fanOutCapabilityForRole,
  fallbackStepOutputSummary,
  hasBlockingQuestion,
} from '@goodboy/core';
import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { isQuestionDelegate } from '../../../features/context/questionDelegate';
import { summarizeWorkflowAgentOutput } from '../workflows/summarizeWorkflowAgentOutput';
import { classifyAgent, KIND_TO_ROLE } from '../../../features/session/agent-kind';
import { agentEmittingProvider } from '../workflowRouting/agentEmittingProvider';
import { fanOutChildKind } from '../agents/fanOutChildKind';
import { persistOrchestrationStop } from '../workflows/orchestrateNextStep';
import {
  agentHasArtifact,
  turnArtifactOutcome,
} from '../../../features/artifacts/turnArtifactOutcome';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly resolvedAgentId: AgentId;
  readonly assistantText: string;
  readonly didAgentDie?: boolean;
  readonly resolveAttemptId?: string;
  readonly now: () => IsoDateTime;
};

export const completeResolvedAgent = async ({
  set,
  get,
  sessionId,
  resolvedAgentId,
  assistantText,
  didAgentDie = false,
  resolveAttemptId,
  now,
}: Params): Promise<boolean | null> => {
  const ranAgent = get().sessionPhaseRuns[sessionId]?.find((run) => run.id === resolvedAgentId);
  if (get().agentTurnState?.[resolvedAgentId]?.kind === 'blocked') {
    if (ranAgent?.stepId != null && ranAgent.workflowRunId != null) {
      await persistOrchestrationStop({
        set,
        sessionId,
        workflowRunId: ranAgent.workflowRunId,
        stop: { kind: 'needs-approval', message: 'Waiting for your permission on a tool call.' },
      });
      return false;
    }
    return null;
  }
  if (ranAgent?.sourceKind === 'comment_recheck') {
    await get().settleThreadRecheck({
      sessionId,
      agentId: resolvedAgentId,
      assistantText,
      didAgentDie,
    });
    return null;
  }
  if (ranAgent !== undefined && isQuestionDelegate({ agent: ranAgent })) {
    await get().resolveQuestionDelegate({ sessionId, agentId: resolvedAgentId, assistantText });
    return null;
  }
  const ranKind =
    ranAgent !== undefined
      ? classifyAgent({
          agent: ranAgent,
          override: get().agentKindOverride[resolvedAgentId] ?? null,
        })
      : null;
  const role = ranKind !== null ? KIND_TO_ROLE[ranKind] : 'custom';
  const capability = fanOutCapabilityForRole(role);
  const emittingProvider = agentEmittingProvider({
    state: get(),
    sessionId,
    agentId: resolvedAgentId,
  });
  const extractedFanOut = extractFanOut({ assistantText, emittingProvider });
  const fanOutKind =
    ranAgent === undefined
      ? null
      : fanOutChildKind({
          agent: ranAgent,
          runs: get().sessionPhaseRuns[sessionId] ?? [],
          agentKindOverride: get().agentKindOverride,
        });
  const isFanOutNode =
    capability.mode !== 'never' &&
    (fanOutKind === 'scout-tree' || (extractedFanOut != null && extractedFanOut.length >= 2));

  if (isFanOutNode) {
    await get().advanceScoutTree(sessionId, resolvedAgentId, assistantText);
    return null;
  }

  if (fanOutKind === 'cluster') {
    await get().advanceClusterImplementation(sessionId, resolvedAgentId, assistantText, {
      didAgentDie,
    });
    return null;
  }

  const captured = captureArtifactFromTurnText({ assistantText, emittingProvider });
  const artifactOutcome = didAgentDie
    ? 'not-expected'
    : turnArtifactOutcome({
        kind: ranKind,
        captured,
        assistantText,
        hasPriorArtifact: agentHasArtifact({
          artifacts: get().sessionArtifacts?.[sessionId],
          agentId: resolvedAgentId,
        }),
      });

  const isWorkflowStep = ranAgent?.stepId != null && ranAgent.workflowRunId != null;
  const blocksOnMissingArtifact =
    artifactOutcome === 'missing' &&
    (!isWorkflowStep || captured.status === 'error' || extractStepDone(assistantText) !== null);

  if (blocksOnMissingArtifact) {
    await invokeAgentUpdateStatus(resolvedAgentId, { status: 'blocked', completedAt: now() });
    const refreshedRuns = await invokeAgentList(sessionId);
    set((state) => ({
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
    }));
    void get().refreshUnreadWorkspaces();
    return isWorkflowStep ? false : null;
  }

  if (!!ranAgent?.stepId && !!ranAgent?.workflowRunId) {
    const planCapturedThisTurn =
      captured.status === 'captured' &&
      captured.artifact.kind === 'plan' &&
      !hasBlockingQuestion({ assistantText });
    const { shouldAutoAdvance } = await get().finalizeWorkflowStep(
      sessionId,
      resolvedAgentId,
      assistantText,
      planCapturedThisTurn || artifactOutcome === 'captured',
      { didAgentDie },
    );
    return shouldAutoAdvance;
  }

  if (ranKind === 'resolver' && ranAgent !== undefined) {
    await get().persistResolveTurn({
      sessionId,
      agent: ranAgent,
      assistantText,
      attemptId: resolveAttemptId,
    });
  }

  const outputSummary =
    ranAgent === undefined
      ? fallbackStepOutputSummary({ output: assistantText })
      : await summarizeWorkflowAgentOutput({
          set,
          get,
          sessionId,
          agent: ranAgent,
          output: assistantText,
        });
  await invokeAgentUpdateStatus(resolvedAgentId, {
    status: 'completed',
    outputSummary,
    completedAt: now(),
  });
  const refreshedRuns = await invokeAgentList(sessionId);
  set((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
  }));
  void get().refreshUnreadWorkspaces();

  if (ranKind === 'pr-reviewer') {
    const reviewComments = extractReviewComments(assistantText);
    if (reviewComments.length > 0) {
      await get().queueAgentReviewComments(sessionId, resolvedAgentId, reviewComments);
    }
    return null;
  }

  return null;
};
