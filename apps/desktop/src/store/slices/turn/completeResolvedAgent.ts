import {
  extractAllCommentAnalysis,
  extractAllCommentReplies,
  extractAllCommentResolved,
  extractAllCommentWontfix,
  extractPlanFromMarker,
  extractReviewComments,
  extractScoutSplit,
  fallbackStepOutputSummary,
} from '@goodboy/core';
import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { inferAgentKindFromName, type AgentKind } from '../../../features/session/agent-kind';
import type { GetFn, SetFn } from './types';
import type { ResolverThreadOutcome } from '../../types';

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

  const resolvedMarkers = extractAllCommentResolved(assistantText);
  const wontfixMarkers = extractAllCommentWontfix(assistantText);
  const analysisMarkers = extractAllCommentAnalysis(assistantText);
  const outcomes: Record<string, ResolverThreadOutcome> = {};
  for (const marker of resolvedMarkers) {
    outcomes[marker.threadId] = { kind: 'resolved', commitSha: marker.commitSha };
  }
  for (const marker of wontfixMarkers) {
    if (outcomes[marker.threadId]?.kind === 'resolved') {
      continue;
    }
    outcomes[marker.threadId] = { kind: 'wontfix', reason: marker.reason };
  }
  for (const marker of analysisMarkers) {
    if (outcomes[marker.threadId]?.kind === 'resolved') {
      continue;
    }
    outcomes[marker.threadId] = { kind: 'analyzed', reply: marker.summary };
  }
  for (const marker of extractAllCommentReplies(assistantText)) {
    const outcome = outcomes[marker.threadId];
    if (outcome !== undefined) {
      outcomes[marker.threadId] = { ...outcome, reply: marker.body };
    }
  }
  const markerCount = resolvedMarkers.length + wontfixMarkers.length + analysisMarkers.length;
  const nextState =
    resolvedMarkers.length > 0
      ? 'committed'
      : markerCount > 0 && wontfixMarkers.length === markerCount
        ? 'wontfix'
        : analysisMarkers.length > 0
          ? 'analyzed'
          : 'awaiting';
  set((state) => ({
    resolverState: { ...state.resolverState, [resolvedAgentId]: nextState },
    resolverThreadOutcomes: {
      ...state.resolverThreadOutcomes,
      [resolvedAgentId]: outcomes,
    },
  }));
  if (markerCount > 0) {
    void get().activateNextResolver(sessionId);
  }
  return null;
};
