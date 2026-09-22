import { fallbackStepOutputSummary, planTaskModelFallback, resolveTaskModel } from '@goodboy/core';
import type { Agent, AgentId, SessionId, TaskModelPreference } from '@goodboy/types';
import type {
  IsoDateTime,
  ProviderRunId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import type { StepOutputUsage } from '@goodboy/core';
import { insertProviderRun, insertTelemetry, updateProviderRunStatus } from '@goodboy/db';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import {
  providersCoolingDown,
  routeTaskModel,
  withFailureCooldown,
} from '../../../features/providers/taskModelRouting';
import { shortModel } from '../../../features/session/agent-row-format';
import { stepForAgent } from '../../../features/workflows/stepForAgent';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolveInvocationLimits } from '../../../shared/lib/invocationAdmission';
import { summarizeAgentOutput, type SummarizeAgentOutputResult } from '../../summarizeAgentOutput';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly output: string;
};

type NotifyParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly modelLabel: string;
  readonly reason: string;
};

type UnavailableParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly unavailable: TaskModelPreference;
  readonly replacement: TaskModelPreference | null;
};

const modelLabelFor = (taskModel: TaskModelPreference): string =>
  `${taskModel.providerId}/${shortModel(taskModel.model)}`;

const notifyModelUnavailable = ({
  get,
  sessionId,
  agent,
  unavailable,
  replacement,
}: UnavailableParams): void => {
  const label = modelLabelFor(unavailable);
  const outcome =
    replacement === null
      ? 'no other provider could take over, so the step output was carried unsummarized'
      : `${modelLabelFor(replacement)} summarized this step instead`;
  void get().emitNotification(
    'summarizer-degraded',
    'warning',
    `summarizer model unavailable: ${label}`,
    `${label} is not available to this account and ${outcome}. change the summarizer model in Providers then Defaults.`,
    {
      sessionId,
      action: { kind: 'retry-step-summary', sessionId, agentId: agent.id as AgentId },
      coalesceKey: `summarizer-model-unavailable:${unavailable.providerId}:${unavailable.model}`,
    },
  );
};

const notifyDegraded = ({ get, sessionId, agent, modelLabel, reason }: NotifyParams): void => {
  const workflowRunId = agent.workflowRunId;
  const stepId = agent.stepId;
  const coalesceKey =
    workflowRunId != null && stepId != null
      ? `step-summary-degraded:${workflowRunId}:${stepId}`
      : `step-summary-degraded:${agent.id}`;
  void get().emitNotification(
    'summarizer-degraded',
    'warning',
    `step summary degraded: ${agent.name}`,
    `${modelLabel}: ${reason}`,
    {
      sessionId,
      action: { kind: 'retry-step-summary', sessionId, agentId: agent.id as AgentId },
      coalesceKey,
    },
  );
};

export const summarizeWorkflowAgentOutput = async ({
  set,
  get,
  sessionId,
  agent,
  output,
}: Params): Promise<string> => {
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  if (session == null) {
    return fallbackStepOutputSummary({ output });
  }
  const connectedProviders = get()
    .providers.filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const enabledProviders = session.providerPreference.enabledProviders ?? null;
  const resolved = resolveTaskModel({
    task: 'summarizer',
    preferences: get().workspaceOverrides?.[session.workspaceId]?.taskModels,
    workspaceDefaultProviderId: get().workspaceOverrides?.[session.workspaceId]?.defaultProviderId,
    sessionDefaultProviderId: session.providerPreference.defaultProvider,
  });
  const taskModel = routeTaskModel({
    taskModel: resolved,
    connectedProviders,
    enabledProviders,
    cooldowns: get().providerCooldowns,
    nowMs: Date.now(),
  });
  if (taskModel === null) {
    notifyDegraded({
      get,
      sessionId,
      agent,
      modelLabel: modelLabelFor(resolved),
      reason: 'every summarizer provider is cooling down',
    });
    return fallbackStepOutputSummary({ output });
  }
  const worktreePath = getSessionRepo({ get, sessionId })?.worktreePath ?? null;
  const expectedOutput =
    stepForAgent({
      agent,
      workflowRuns: session.workflowRuns,
      workflows: [
        ...(get().phaseTemplates?.[session.workspaceId] ?? []),
        ...(get().sessionWorkflows?.[sessionId] ?? []),
      ],
    })?.expectedOutput ?? '';
  const runOnce = (model: TaskModelPreference): Promise<SummarizeAgentOutputResult> => {
    const invocationId = crypto.randomUUID();
    const providerRunId = invocationId as ProviderRunId;
    const providerIdentity =
      get().workspaceOverrides?.[session.workspaceId]?.providerBindings?.[model.providerId] ??
      get().authResults?.[model.providerId]?.identity ??
      null;
    const onUsage = async (usage: StepOutputUsage): Promise<void> => {
      const recordedAt = new Date().toISOString() as IsoDateTime;
      await insertProviderRun(tauriDatabase, {
        id: providerRunId,
        sessionId,
        provider: model.providerId,
        model: usage.model,
        status: { kind: 'streaming', startedAt: recordedAt },
        createdAt: recordedAt,
      });
      await updateProviderRunStatus(tauriDatabase, providerRunId, {
        kind: 'succeeded',
        finishedAt: recordedAt,
      });
      const record: TelemetryRecord = {
        id: crypto.randomUUID() as TelemetryRecordId,
        runId: providerRunId,
        sessionId,
        kind: 'summarizer',
        provider: model.providerId,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        cacheCreationInputTokens: usage.cacheCreationInputTokens,
        estimatedCostUsd: usage.estimatedCostUsd,
        recordedAt,
        invocationId: usage.invocationId ?? invocationId,
        ...(agent.workflowRunId != null && { workflowRunId: agent.workflowRunId }),
        agentId: agent.id,
        purpose: 'summarizer',
        usageEventId: 'usage',
        attributionStatus: agent.workflowRunId == null ? 'unattributed' : 'attributed',
      };
      await insertTelemetry(tauriDatabase, record);
      set((state) => ({
        sessionTelemetry: {
          ...state.sessionTelemetry,
          [sessionId]: [...(state.sessionTelemetry[sessionId] ?? []), record],
        },
      }));
    };
    return summarizeAgentOutput({
      agentId: agent.id,
      output,
      taskModel: model,
      ...(worktreePath != null && { workingDir: worktreePath }),
      ...(expectedOutput !== '' && { expectedOutput }),
      invocation: {
        invocationId,
        workspaceId: session.workspaceId,
        sessionId,
        ...(agent.workflowRunId != null && { workflowRunId: agent.workflowRunId }),
        agentId: agent.id,
        ...(providerIdentity != null && { providerIdentity }),
        purpose: 'summarizer',
        isHeavyweight: false,
        limits: resolveInvocationLimits({
          providerId: model.providerId,
          workspaceOverride: get().workspaceOverrides?.[session.workspaceId],
        }),
      },
      onUsage,
    });
  };
  const recordCooldown = (model: TaskModelPreference, message: string): void => {
    const failure = classifyProviderError({ message });
    const isCooldownEligible =
      failure.kind === 'usage_limit' ||
      failure.kind === 'authentication' ||
      failure.kind === 'rate_limit';
    if (!isCooldownEligible) {
      return;
    }
    set((state) => ({
      providerCooldowns: withFailureCooldown({
        cooldowns: state.providerCooldowns,
        provider: model.providerId,
        failure,
        nowMs: Date.now(),
      }),
    }));
  };

  const result = await runOnce(taskModel);
  if (!result.degraded) {
    return result.summary;
  }

  const message = result.error ?? '';
  const failure = classifyProviderError({ message });
  const isModelUnavailable = failure.kind === 'model_not_available';
  recordCooldown(taskModel, message);
  const fallback = planTaskModelFallback({
    failure: failure.kind,
    taskModel,
    attempt: 0,
    connectedProviders,
    enabledProviders,
    coolingDownProviders: providersCoolingDown({
      cooldowns: get().providerCooldowns,
      nowMs: Date.now(),
    }),
  });
  if (fallback === null) {
    if (isModelUnavailable) {
      notifyModelUnavailable({ get, sessionId, agent, unavailable: taskModel, replacement: null });
      return result.summary;
    }
    notifyDegraded({
      get,
      sessionId,
      agent,
      modelLabel: modelLabelFor(taskModel),
      reason: result.error ?? 'summarization failed',
    });
    return result.summary;
  }

  const retried = await runOnce(fallback);
  if (isModelUnavailable) {
    if (retried.degraded) {
      recordCooldown(fallback, retried.error ?? '');
    }
    notifyModelUnavailable({
      get,
      sessionId,
      agent,
      unavailable: taskModel,
      replacement: retried.degraded ? null : fallback,
    });
    return retried.summary;
  }
  if (!retried.degraded) {
    return retried.summary;
  }
  recordCooldown(fallback, retried.error ?? '');
  notifyDegraded({
    get,
    sessionId,
    agent,
    modelLabel: modelLabelFor(fallback),
    reason: retried.error ?? 'summarization failed',
  });
  return retried.summary;
};
