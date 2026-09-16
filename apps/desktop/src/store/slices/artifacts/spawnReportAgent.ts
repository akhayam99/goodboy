import { getCheapModel, resolveRoleRouting } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type {
  AgentEffort,
  AgentId,
  IsoDateTime,
  ProviderId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  artifactEvidenceInventory,
  recordArtifactProvenance,
} from '../../../features/artifacts/artifactProvenance';
import { buildReportContext } from '../../../features/reports/buildReportContext';
import { collectReportDiffEvidence } from '../../../features/reports/collectReportDiffEvidence';
import { REPORT_TYPE_LABEL, type ReportType } from '../../../features/reports/reportTypes';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import type { SpawnFocus } from '../session-view/spawnFocus';
import type { GetFn } from './types';

export type ReportRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
};

export type SpawnReportAgentParams = {
  readonly sessionId: SessionId;
  readonly reportType: ReportType;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly routing?: ReportRouting | null;
  readonly brief?: string | null;
  readonly evidence?: string | null;
  readonly focus?: SpawnFocus;
};

type State = ReturnType<GetFn>;

type RoutingParams = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly picked: ReportRouting | null;
};

export const resolveReportRouting = ({
  state,
  sessionId,
  picked,
}: RoutingParams): ReportRouting => {
  if (picked !== null) {
    return picked;
  }
  const session = state.sessions?.find((entry) => entry.id === sessionId) ?? null;
  const overrides =
    session === null ? null : (state.workspaceOverrides?.[session.workspaceId] ?? null);
  const role = resolveRoleRouting({ role: 'report', prefs: overrides?.roleModels });
  if (role.isOverride) {
    return { provider: role.provider, model: role.model, effort: role.effort };
  }
  const availability = workflowAvailabilitySnapshot({
    providers: state.providers ?? [],
    cooldowns: state.providerCooldowns ?? {},
    alerts: state.budgetAlerts ?? [],
    sessionId,
    isRunBudgetBlocked: false,
    nowMs: Date.now(),
  });
  const usable = availability.connectedProviders.filter(
    (provider) =>
      !availability.coolingDownProviders.includes(provider) &&
      !availability.budgetBlockedProviders.includes(provider),
  );
  const provider = usable.includes(role.provider) ? role.provider : usable[0];
  if (provider === undefined) {
    return { provider: role.provider, model: role.model, effort: role.effort };
  }
  return { provider, model: getCheapModel(provider), effort: 'low' };
};

export const spawnReportAgent = (get: GetFn) => {
  return async ({
    sessionId,
    reportType,
    workflowRunId = null,
    routing = null,
    brief = null,
    evidence = null,
    focus = 'agent',
  }: SpawnReportAgentParams): Promise<AgentId> => {
    const state = get();
    const session = state.sessions?.find((entry) => entry.id === sessionId) ?? null;
    if (session === null) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const resolved = resolveReportRouting({ state, sessionId, picked: routing });
    if (evidence !== null && evidence.trim().length > 0) {
      return get().spawnAgent(sessionId, {
        kindOverride: 'report',
        name: REPORT_TYPE_LABEL[reportType],
        provider: resolved.provider,
        model: resolved.model,
        effort: resolved.effort,
        initialPrompt: evidence,
        focus,
      });
    }
    const diff = await collectReportDiffEvidence({ state, sessionId });
    const context = buildReportContext({
      reportType,
      brief,
      session,
      agents: state.sessionPhaseRuns?.[sessionId] ?? [],
      transcripts: state.transcripts ?? {},
      artifacts: state.sessionArtifacts?.[sessionId] ?? [],
      events: state.sessionEvents?.[sessionId] ?? [],
      scriptRuns: state.scriptRuns?.[sessionId] ?? {},
      diff: diff.evidence,
      diffUnavailableReason: diff.reason,
      workflowRunId,
      capturedAt: new Date().toISOString() as IsoDateTime,
    });
    const agentId = await get().spawnAgent(sessionId, {
      kindOverride: 'report',
      name: REPORT_TYPE_LABEL[reportType],
      provider: resolved.provider,
      model: resolved.model,
      effort: resolved.effort,
      initialPrompt: context.text,
      focus,
    });
    await recordArtifactProvenance({
      agentId,
      sessionId,
      kind: 'report',
      brief,
      evidence: artifactEvidenceInventory({
        sourceIds: context.sourceIds,
        session,
        agents: state.sessionPhaseRuns?.[sessionId] ?? [],
        artifacts: state.sessionArtifacts?.[sessionId] ?? [],
        sourceWorkflowRunId: workflowRunId,
      }),
      omissions: context.truncations,
      designProfileSummary: null,
      sourceWorkflowRunId: workflowRunId,
      executingWorkflowRunId: null,
    }).catch((error: unknown) => {
      console.warn(`[artifact-provenance] report ${agentId}: ${formatError(error)}`);
    });
    return agentId;
  };
};
