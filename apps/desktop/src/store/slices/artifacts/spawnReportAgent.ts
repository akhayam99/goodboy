import { getCheapModel, resolveRoleRouting } from '@goodboy/core';
import type {
  AgentEffort,
  AgentId,
  IsoDateTime,
  ProviderId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  buildReportContext,
  type ReportDiffEvidence,
} from '../../../features/reports/buildReportContext';
import { REPORT_TYPE_LABEL, type ReportType } from '../../../features/reports/reportTypes';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { listBranchCommits, worktreeChangedFiles } from '../../../features/worktree/worktree';
import { selectActiveMount } from '../project-mounts/selectors';
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
  readonly evidence?: string | null;
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

type DiffParams = {
  readonly state: State;
  readonly sessionId: SessionId;
};

const collectDiffEvidence = async ({
  state,
  sessionId,
}: DiffParams): Promise<ReportDiffEvidence | null> => {
  const mount = selectActiveMount({ state, sessionId });
  if (mount === null || mount.worktreePath.length === 0) {
    return null;
  }
  const baseBranch = mount.baseBranch ?? 'main';
  try {
    const [changed, commits] = await Promise.all([
      worktreeChangedFiles({ worktreePath: mount.worktreePath, baseBranch }),
      listBranchCommits(mount.worktreePath).catch(() => []),
    ]);
    return {
      mountName: mount.mountName,
      baseBranch,
      headSha: commits[0]?.sha ?? null,
      commits: commits.map((commit) => ({ sha: commit.shortSha, subject: commit.subject })),
      additions: changed.additions,
      deletions: changed.deletions,
      paths: changed.paths,
    };
  } catch {
    return null;
  }
};

export const spawnReportAgent = (get: GetFn) => {
  return async ({
    sessionId,
    reportType,
    workflowRunId = null,
    routing = null,
    evidence = null,
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
        focus: 'agent',
      });
    }
    const diff = await collectDiffEvidence({ state, sessionId });
    const context = buildReportContext({
      reportType,
      session,
      agents: state.sessionPhaseRuns?.[sessionId] ?? [],
      transcripts: state.transcripts ?? {},
      artifacts: state.sessionArtifacts?.[sessionId] ?? [],
      events: state.sessionEvents?.[sessionId] ?? [],
      scriptRuns: state.scriptRuns?.[sessionId] ?? {},
      diff,
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
      focus: 'agent',
    });
    return agentId;
  };
};
