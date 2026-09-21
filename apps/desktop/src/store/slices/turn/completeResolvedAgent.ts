import {
  captureArtifactFromTurnText,
  extractFanOut,
  extractReviewComments,
  fanOutCapabilityForRole,
  fallbackStepOutputSummary,
} from '@goodboy/core';
import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { summarizeWorkflowAgentOutput } from '../workflows/summarizeWorkflowAgentOutput';
import {
  inferAgentKindFromName,
  KIND_TO_ROLE,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { agentEmittingProvider } from '../workflowRouting/agentEmittingProvider';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly resolvedAgentId: AgentId;
  readonly assistantText: string;
  readonly resolveAttemptId?: string;
  readonly now: () => IsoDateTime;
};

export const completeResolvedAgent = async ({
  set,
  get,
  sessionId,
  resolvedAgentId,
  assistantText,
  resolveAttemptId,
  now,
}: Params): Promise<boolean | null> => {
  const ranAgent = get().sessionPhaseRuns[sessionId]?.find((run) => run.id === resolvedAgentId);
  const ranKind = ranAgent
    ? ((ranAgent.kind as AgentKind | undefined) ??
      get().agentKindOverride[resolvedAgentId] ??
      inferAgentKindFromName(ranAgent.name))
    : null;
  const role = ranKind ? KIND_TO_ROLE[ranKind] : 'custom';
  const capability = fanOutCapabilityForRole(role);
  const emittingProvider = agentEmittingProvider({
    state: get(),
    sessionId,
    agentId: resolvedAgentId,
  });
  const extractedFanOut = extractFanOut({ assistantText, emittingProvider });
  const isFanOutNode =
    capability.mode !== 'never' &&
    (ranAgent?.parentAgentId != null || (extractedFanOut != null && extractedFanOut.length >= 2));

  if (isFanOutNode) {
    await get().advanceScoutTree(sessionId, resolvedAgentId, assistantText);
    return null;
  }

  if (ranAgent?.parentAgentId) {
    await get().advanceClusterImplementation(sessionId, resolvedAgentId, assistantText);
    return null;
  }

  if (!!ranAgent?.stepId && !!ranAgent?.workflowRunId) {
    const captured = captureArtifactFromTurnText({ assistantText, emittingProvider });
    const planCapturedThisTurn =
      captured.status === 'captured' && captured.artifact.kind === 'plan';
    const { shouldAutoAdvance } = await get().finalizeWorkflowStep(
      sessionId,
      resolvedAgentId,
      assistantText,
      planCapturedThisTurn,
    );
    return shouldAutoAdvance;
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

  if (ranKind !== 'resolver') {
    return null;
  }

  if (ranAgent !== undefined) {
    await get().persistResolveTurn({
      sessionId,
      agent: ranAgent,
      assistantText,
      attemptId: resolveAttemptId,
    });
  }
  return null;
};
