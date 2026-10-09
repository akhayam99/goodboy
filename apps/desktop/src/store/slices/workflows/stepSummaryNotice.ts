import type { BackgroundAttempt } from '@goodboy/core';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import type { GetFn } from './types';

const stepSummaryNoticeKey = ({ sessionId }: { readonly sessionId: SessionId }): string =>
  `step-summary-degraded:${sessionId}`;

type FailedParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly attempts: ReadonlyArray<BackgroundAttempt>;
};

const triedProviders = (attempts: ReadonlyArray<BackgroundAttempt>): string => {
  const labels = [...new Set(attempts.map((attempt) => PROVIDER_LABEL[attempt.model.providerId]))];
  return labels.join(', ');
};

export const notifyStepSummaryFailed = ({
  get,
  sessionId,
  agent,
  attempts,
}: FailedParams): void => {
  const cause =
    attempts.length === 0
      ? 'Every summarizer provider is cooling down'
      : `Every summarizer model failed (${triedProviders(attempts)})`;
  void get().emitNotification({
    kind: 'summarizer-degraded',
    severity: 'warning',
    title: 'Step summary unavailable',
    body: `${cause}, so the output of ${agent.name} was carried over unsummarized. Retry once a provider is back.`,
    sessionId,
    action: { kind: 'retry-step-summary', sessionId, agentId: agent.id as AgentId },
    coalesceKey: stepSummaryNoticeKey({ sessionId }),
    isOnce: true,
  });
};

type ResolveParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const resolveStepSummaryNotice = ({ get, sessionId }: ResolveParams): void => {
  const degraded = get().stepSummaryDegraded;
  const hasDegraded = (get().sessionPhaseRuns[sessionId] ?? []).some(
    (agent) => degraded[agent.id] === true,
  );
  if (hasDegraded) {
    return;
  }
  void get().resolveNotifications([stepSummaryNoticeKey({ sessionId })]);
};
