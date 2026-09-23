import type { PlannerUsage } from '@goodboy/core';
import type { ProviderId, SessionId } from '@goodboy/types';
import { recordOrchestratorUsage } from './recordOrchestratorUsage';
import type { GetFn, SetFn } from './types';

export type RecordPlannerUsageParams = {
  readonly sessionId: SessionId;
  readonly provider: ProviderId;
  readonly model: string;
  readonly usage: PlannerUsage;
};

export const recordPlannerUsage =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId, provider, model, usage }: RecordPlannerUsageParams): Promise<void> =>
    recordOrchestratorUsage({
      set,
      get,
      sessionId,
      agentId: null,
      workflowRunId: null,
      provider,
      model: usage.model ?? model,
      usage,
      purpose: 'planner',
    });
