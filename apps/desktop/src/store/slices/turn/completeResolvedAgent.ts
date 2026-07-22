import {
  extractCommentAnalysis,
  extractCommentResolved,
  extractCommentWontfix,
  extractPlanFromMarker,
  extractScoutSplit,
  fallbackStepOutputSummary,
} from '@goodboy/core';
import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { inferAgentKindFromName, type AgentKind } from '../../../features/session/agent-kind';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly resolvedAgentId: AgentId;
  readonly assistantText: string;
  readonly now: () => IsoDateTime;
};

export const completeResolvedAgent = async ({
  set,
  get,
  sessionId,
  resolvedAgentId,
  assistantText,
  now,
}: Params): Promise<boolean | null> => {
  const ranAgent = get().sessionPhaseRuns[sessionId]?.find((run) => run.id === resolvedAgentId);
  const ranKind = ranAgent
    ? ((ranAgent.kind as AgentKind | undefined) ??
      get().agentKindOverride[resolvedAgentId] ??
      inferAgentKindFromName(ranAgent.name))
    : null;
  const isScoutNode =
    ranKind === 'scout' &&
    (ranAgent?.parentAgentId != null || extractScoutSplit(assistantText) != null);

  if (isScoutNode) {
    await get().advanceScoutTree(sessionId, resolvedAgentId, assistantText);
    return null;
  }

  if (ranAgent?.parentAgentId) {
    await get().advanceClusterImplementation(sessionId, resolvedAgentId, assistantText);
    return null;
  }

  if (!!ranAgent?.stepId && !!ranAgent?.workflowRunId) {
    const planCapturedThisTurn = extractPlanFromMarker(assistantText) !== null;
    const { shouldAutoAdvance } = await get().finalizeWorkflowStep(
      sessionId,
      resolvedAgentId,
      assistantText,
      planCapturedThisTurn,
    );
    return shouldAutoAdvance;
  }

  const outputSummary = fallbackStepOutputSummary({ output: assistantText });
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

  if (ranKind !== 'resolver') {
    return null;
  }

  const resolvedMarker = extractCommentResolved(assistantText);
  const wontfixMarker = extractCommentWontfix(assistantText);
  const analysisMarker = extractCommentAnalysis(assistantText);
  const nextState =
    resolvedMarker !== null
      ? 'committed'
      : wontfixMarker !== null
        ? 'wontfix'
        : analysisMarker !== null
          ? 'analyzed'
          : 'awaiting';
  set((state) => ({
    resolverState: { ...state.resolverState, [resolvedAgentId]: nextState },
  }));
  if (resolvedMarker !== null || wontfixMarker !== null || analysisMarker !== null) {
    void get().activateNextResolver(sessionId);
  }
  return null;
};
