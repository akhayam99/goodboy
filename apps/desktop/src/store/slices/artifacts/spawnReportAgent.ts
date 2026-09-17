import { getCheapModel, resolveRoleRouting } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type {
  AgentEffort,
  AgentId,
  MountId,
  ProviderId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { ArtifactAttachment } from '../../../features/artifacts/artifactAttachments';
import { recordArtifactProvenance } from '../../../features/artifacts/artifactProvenance';
import {
  resolveArtifactMounts,
  selectDefaultArtifactMountIds,
} from '../../../features/artifacts/artifactMountChoice';
import { pickArtifactScouts } from '../../../features/artifacts/pickArtifactScouts';
import { prepareArtifactEvidence } from '../../../features/artifacts/prepareArtifactEvidence';
import { sessionGoalText } from '../../../features/artifacts/sessionGoalText';
import { collectReportDiffEvidence } from '../../../features/reports/collectReportDiffEvidence';
import { REPORT_TYPE_LABEL, type ReportType } from '../../../features/reports/reportTypes';
import { WIREFRAME_SCOUT_DEADLINE_MS } from '../../../features/wireframes/wireframeScoutReports';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import type { SpawnFocus } from '../session-view/spawnFocus';
import type { ArtifactRunMount } from './artifactScoutRun';
import type { GetFn } from './types';

export const REPORT_SCOUT_PENDING_NOTE =
  'the scouts had not reported yet when this row was written';

const REPORT_SCOUT_ROOT = '.';

export const REPORT_SCOUT_SKIP_BUDGET =
  'this session is budget blocked, so no scout read a repository';

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
  readonly attachments: ReadonlyArray<ArtifactAttachment>;
  readonly mountIds?: ReadonlyArray<MountId>;
  readonly evidence?: string | null;
  readonly focus?: SpawnFocus;
};

type State = ReturnType<GetFn>;

type UsableParams = {
  readonly state: State;
  readonly sessionId: SessionId;
};

const usableProviders = ({ state, sessionId }: UsableParams): ReadonlyArray<ProviderId> => {
  const availability = workflowAvailabilitySnapshot({
    providers: state.providers ?? [],
    cooldowns: state.providerCooldowns ?? {},
    alerts: state.budgetAlerts ?? [],
    sessionId,
    isRunBudgetBlocked: false,
    nowMs: Date.now(),
  });
  return availability.connectedProviders.filter(
    (provider) =>
      !availability.coolingDownProviders.includes(provider) &&
      !availability.budgetBlockedProviders.includes(provider),
  );
};

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
  const usable = usableProviders({ state, sessionId });
  const provider = usable.includes(role.provider) ? role.provider : usable[0];
  if (provider === undefined) {
    return { provider: role.provider, model: role.model, effort: role.effort };
  }
  return { provider, model: getCheapModel(provider), effort: 'low' };
};

const withScoutNote = ({
  omissions,
  note,
}: {
  readonly omissions: ReadonlyArray<string>;
  readonly note: string | null;
}): ReadonlyArray<string> => (note === null ? omissions : [...omissions, note]);

type ScoutMountParams = Readonly<{
  state: State;
  sessionId: SessionId;
  mountIds: ReadonlyArray<MountId>;
}>;

const reportScoutMounts = ({
  state,
  sessionId,
  mountIds,
}: ScoutMountParams): ReadonlyArray<ArtifactRunMount> =>
  resolveArtifactMounts({ state, sessionId, mountIds }).map((mount) => ({
    mountId: mount.mountId,
    mountName: mount.mountName,
    root: REPORT_SCOUT_ROOT,
    worktreePath: mount.worktreePath,
  }));

export const spawnReportAgent = (get: GetFn) => {
  return async ({
    sessionId,
    reportType,
    workflowRunId = null,
    routing = null,
    brief = null,
    attachments,
    mountIds,
    evidence = null,
    focus = 'agent',
  }: SpawnReportAgentParams): Promise<AgentId> => {
    const state = get();
    const session = state.sessions?.find((entry) => entry.id === sessionId) ?? null;
    if (session === null) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const resolved = resolveReportRouting({ state, sessionId, picked: routing });
    const name = REPORT_TYPE_LABEL[reportType];
    if (evidence !== null && evidence.trim().length > 0) {
      return get().spawnAgent(sessionId, {
        kindOverride: 'report',
        name,
        provider: resolved.provider,
        model: resolved.model,
        effort: resolved.effort,
        initialPrompt: evidence,
        focus,
      });
    }
    const slots = await state.ensureSessionSlots(sessionId);
    const goal = sessionGoalText({ slots, session });
    const chosenMountIds = mountIds ?? selectDefaultArtifactMountIds({ state, sessionId });
    const mounts = reportScoutMounts({ state, sessionId, mountIds: chosenMountIds });
    const readMountIds = mounts.map((mount) => mount.mountId);
    const diff =
      reportType === 'change-summary' && mounts.length > 0
        ? await collectReportDiffEvidence({
            state,
            sessionId,
            mountIds: readMountIds,
          }).catch(() => null)
        : null;
    const changedMountIds: ReadonlyArray<MountId> =
      diff === null || diff.evidence === null || diff.mountId === null ? [] : [diff.mountId];
    const roster = await pickArtifactScouts({
      kind: 'report',
      reportType,
      changedMountIds,
      mounts: mounts.map((mount) => ({
        mountId: mount.mountId,
        label: mount.mountName,
        root: mount.root,
      })),
      probe: async () => [],
    });
    const isBudgetBlocked = usableProviders({ state, sessionId }).length === 0;
    const scoutNote = isBudgetBlocked ? REPORT_SCOUT_SKIP_BUDGET : roster.note;
    if (roster.picks.length > 0 && !isBudgetBlocked) {
      const containerId = await get().spawnAgent(sessionId, {
        kindOverride: 'report',
        name,
        provider: resolved.provider,
        model: resolved.model,
        effort: resolved.effort,
        focus,
      });
      await recordArtifactProvenance({
        sessionId,
        kind: 'report',
        brief,
        evidence: [],
        omissions: [REPORT_SCOUT_PENDING_NOTE],
        designProfileSummary: null,
        hasDesignEvidence: false,
        phase: 'gathering',
        scoutPlan: [],
        mountIds: readMountIds,
        target: null,
        deadlineAt: Date.now() + WIREFRAME_SCOUT_DEADLINE_MS,
        sourceWorkflowRunId: workflowRunId,
        agentId: containerId,
        executingWorkflowRunId: null,
      }).catch((error: unknown) => {
        console.warn(`[artifact-provenance] report ${containerId}: ${formatError(error)}`);
      });
      const isStarted = await get().startReportScouts({
        sessionId,
        containerId,
        mounts,
        reportType,
        changedMountIds,
        changedPaths: diff?.evidence?.paths ?? [],
        workflowRunId,
        brief,
        attachments,
        goal: goal.packText,
      });
      if (isStarted) {
        return containerId;
      }
      const fallback = await prepareArtifactEvidence({
        kind: 'report',
        reportType,
        scouts: { names: [], section: null, note: scoutNote },
        state: get(),
        session,
        workflowRunId,
        brief,
        attachments,
        mountIds: readMountIds,
        executingAgentId: containerId,
      });
      await recordArtifactProvenance({
        ...fallback.provenance,
        omissions: withScoutNote({ omissions: fallback.provenance.omissions, note: scoutNote }),
        mountIds: readMountIds,
        agentId: containerId,
        executingWorkflowRunId: null,
      }).catch((error: unknown) => {
        console.warn(`[artifact-provenance] report ${containerId}: ${formatError(error)}`);
      });
      void get().sendTurn({ sessionId, agentId: containerId, content: fallback.text });
      return containerId;
    }
    const prepared = await prepareArtifactEvidence({
      kind: 'report',
      reportType,
      scouts: { names: [], section: null, note: scoutNote },
      state,
      session,
      workflowRunId,
      brief,
      attachments,
      mountIds: readMountIds,
      executingAgentId: null,
    });
    const agentId = await get().spawnAgent(sessionId, {
      kindOverride: 'report',
      name,
      provider: resolved.provider,
      model: resolved.model,
      effort: resolved.effort,
      initialPrompt: prepared.text,
      focus,
    });
    await recordArtifactProvenance({
      ...prepared.provenance,
      omissions: withScoutNote({ omissions: prepared.provenance.omissions, note: scoutNote }),
      mountIds: readMountIds,
      agentId,
      executingWorkflowRunId: null,
    }).catch((error: unknown) => {
      console.warn(`[artifact-provenance] report ${agentId}: ${formatError(error)}`);
    });
    return agentId;
  };
};
