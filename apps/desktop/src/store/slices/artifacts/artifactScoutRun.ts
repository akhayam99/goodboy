import type {
  Agent,
  AgentId,
  ArtifactProvenance,
  ArtifactScoutPlanEntry,
  IsoDateTime,
  MountId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { ArtifactAttachment } from '../../../features/artifacts/artifactAttachments';
import {
  advanceArtifactRun,
  loadArtifactProvenance,
  recordArtifactProvenance,
} from '../../../features/artifacts/artifactProvenance';
import {
  extractCitedPaths,
  verifyCitedPaths,
  type CitedPathVerification,
} from '../../../features/artifacts/citedPaths';
import {
  artifactScoutPlanEntries,
  pickArtifactScouts,
  type ArtifactScoutPick,
} from '../../../features/artifacts/pickArtifactScouts';
import { ARTIFACT_SCOUT_ROLES } from '../../../features/artifacts/artifactScoutRoles';
import { prepareArtifactEvidence } from '../../../features/artifacts/prepareArtifactEvidence';
import { exploreList } from '../../../features/explore/explore';
import { collectReportDiffEvidence } from '../../../features/reports/collectReportDiffEvidence';
import { composeDiffScoutKickoff } from '../../../features/reports/composeDiffScoutKickoff';
import { requestedReportType, type ReportType } from '../../../features/reports/reportTypes';
import {
  requestedWireframeFidelity,
  type WireframeFidelity,
} from '../../../features/wireframes/wireframeFidelity';
import type { WireframeTarget } from '../../../features/wireframes/wireframeTarget';
import {
  collectWireframeScoutReports,
  wireframeScoutSection,
  wireframeScoutSectionEntry,
  WIREFRAME_SCOUT_DEADLINE_MS,
  WIREFRAME_SCOUT_DEADLINE_REASON,
  WIREFRAME_SCOUT_RESTART_REASON,
  type WireframeScoutSectionEntry,
} from '../../../features/wireframes/wireframeScoutReports';
import { WIREFRAME_SCOUT_STOP_REASON } from '../../../features/wireframes/wireframeScoutProgress';
import {
  composeWireframeScoutKickoff,
  type WireframeScout,
} from '../../../features/wireframes/wireframeScoutRoles';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { selectMountById } from '../project-mounts/selectors';
import { startFanOutChildren } from '../workflows/scoutTree';
import { openTurnStartWindow } from '../turn/turnStartWindow';
import type { GetFn, SetFn } from './types';

export type ArtifactRunKind = 'wireframe' | 'report';

export const artifactRunRestartSummary = ({ kind }: Readonly<{ kind: ArtifactRunKind }>): string =>
  `the app restarted before the scouts finished, so this ${kind} was never written. try again.`;

export type ArtifactRunMount = Readonly<{
  mountId: MountId;
  mountName: string;
  root: string;
  worktreePath: string;
}>;

type ArtifactRunShape =
  | Readonly<{ kind: 'wireframe'; fidelity: WireframeFidelity; target: WireframeTarget }>
  | Readonly<{ kind: 'report'; reportType: ReportType }>;

type ArtifactRunContext = Readonly<{
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  brief: string | null;
  attachments: ReadonlyArray<ArtifactAttachment>;
  hasLostAttachments: boolean;
  mounts: ReadonlyArray<ArtifactRunMount>;
  picks: ReadonlyArray<ArtifactScoutPick>;
}> &
  ArtifactRunShape;

export const ARTIFACT_RUN_LOST_ATTACHMENTS_NOTE =
  'the app restarted while the scouts were out, so the files attached to the brief are not in this pack';

const scoutsOf = ({
  picks,
}: Readonly<{ picks: ReadonlyArray<ArtifactScoutPick> }>): ReadonlyArray<WireframeScout> =>
  picks.map((pick) => ({ id: pick.roleId, name: pick.name, scope: pick.scope }));

const containers = new Map<AgentId, ArtifactRunContext>();
const deadlines = new Map<AgentId, ReturnType<typeof setTimeout>>();
const joined = new Set<AgentId>();

export const resetArtifactScoutRegistry = (): void => {
  for (const handle of deadlines.values()) {
    clearTimeout(handle);
  }
  containers.clear();
  deadlines.clear();
  joined.clear();
};

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const probeRelPath = ({ root, relPath }: Readonly<{ root: string; relPath: string }>): string => {
  const base = root === '.' ? '' : root;
  if (base.length === 0) {
    return relPath;
  }
  return relPath.length === 0 ? base : `${base}/${relPath}`;
};

const TERMINAL: ReadonlyArray<Agent['status']> = ['completed', 'failed', 'skipped'];

const RECOVERABLE_KINDS: ReadonlyArray<Agent['kind']> = ['wireframe', 'report'];

const childrenOf = ({
  agents,
  containerId,
}: Readonly<{ agents: ReadonlyArray<Agent>; containerId: AgentId }>): ReadonlyArray<Agent> =>
  agents
    .filter((agent) => agent.parentAgentId === containerId && agent.deletedAt == null)
    .sort((left, right) => left.ordinal - right.ordinal);

const clearDeadline = ({ containerId }: Readonly<{ containerId: AgentId }>): void => {
  const handle = deadlines.get(containerId);
  if (handle !== undefined) {
    clearTimeout(handle);
    deadlines.delete(containerId);
  }
};

const mountOf = ({
  mounts,
  mountId,
}: Readonly<{
  mounts: ReadonlyArray<ArtifactRunMount>;
  mountId: MountId;
}>): ArtifactRunMount | null => mounts.find((mount) => mount.mountId === mountId) ?? null;

type StartParams = Readonly<{
  sessionId: SessionId;
  containerId: AgentId;
  mounts: ReadonlyArray<ArtifactRunMount>;
  workflowRunId: WorkflowRunId | null;
  brief: string | null;
  attachments: ReadonlyArray<ArtifactAttachment>;
  goal: string;
}> &
  (
    | Readonly<{ kind: 'wireframe'; fidelity: WireframeFidelity; target: WireframeTarget }>
    | Readonly<{
        kind: 'report';
        reportType: ReportType;
        changedMountIds: ReadonlyArray<MountId>;
        changedPaths: ReadonlyArray<string>;
      }>
  );

const rosterFor = async ({
  mounts,
  params,
}: Readonly<{
  mounts: ReadonlyArray<ArtifactRunMount>;
  params: StartParams;
}>) => {
  const probe = async ({ mountId, relPath }: Readonly<{ mountId: MountId; relPath: string }>) => {
    const mount = mountOf({ mounts, mountId });
    if (mount === null) {
      return [];
    }
    const entries = await exploreList({
      sessionDir: mount.worktreePath,
      relPath: probeRelPath({ root: mount.root, relPath }),
    }).catch(() => []);
    return entries.filter((entry) => entry.isDir).map((entry) => entry.name);
  };
  const catalogue = mounts.map((mount) => ({
    mountId: mount.mountId,
    label: mount.mountName,
    root: mount.root,
  }));
  if (params.kind === 'wireframe') {
    return pickArtifactScouts({
      kind: 'wireframe',
      fidelity: params.fidelity,
      target: params.target,
      mounts: catalogue,
      probe,
    });
  }
  return pickArtifactScouts({
    kind: 'report',
    reportType: params.reportType,
    changedMountIds: params.changedMountIds,
    mounts: catalogue,
    probe,
  });
};

const kickoffFor = ({
  params,
  pick,
  scout,
  others,
}: Readonly<{
  params: StartParams;
  pick: ArtifactScoutPick;
  scout: WireframeScout;
  others: ReadonlyArray<WireframeScout>;
}>): string => {
  if (params.kind === 'wireframe') {
    return composeWireframeScoutKickoff({
      scout,
      others,
      root: pick.root,
      goal: params.goal,
      brief: params.brief,
    });
  }
  return composeDiffScoutKickoff({
    scout,
    others,
    root: pick.root,
    goal: params.goal,
    brief: params.brief,
    paths: params.changedPaths,
  });
};

const contextFor = ({
  params,
  picks,
}: Readonly<{
  params: StartParams;
  picks: ReadonlyArray<ArtifactScoutPick>;
}>): ArtifactRunContext => {
  const base = {
    sessionId: params.sessionId,
    workflowRunId: params.workflowRunId,
    brief: params.brief,
    attachments: params.attachments,
    hasLostAttachments: false,
    mounts: params.mounts,
    picks,
  };
  if (params.kind === 'wireframe') {
    return { ...base, kind: 'wireframe', fidelity: params.fidelity, target: params.target };
  }
  return { ...base, kind: 'report', reportType: params.reportType };
};

const startArtifactScouts = async ({
  set,
  get,
  params,
}: Readonly<{ set: SetFn; get: GetFn; params: StartParams }>): Promise<boolean> => {
  const { sessionId, containerId, mounts } = params;
  const agents = get().sessionPhaseRuns?.[sessionId] ?? [];
  const container = agents.find((agent) => agent.id === containerId) ?? null;
  if (container === null) {
    return false;
  }
  const roster = await rosterFor({ mounts, params });
  if (roster.picks.length === 0) {
    return false;
  }
  const scouts = scoutsOf({ picks: roster.picks });
  const started = await startFanOutChildren({
    set,
    get,
    sessionId,
    container,
    role: 'scout',
    childKind: 'scout',
    specs: roster.picks.map((pick, index) => {
      const scout = scouts[index]!;
      return {
        name: scout.name,
        promptText: `${scout.name}\n${scout.scope}`,
        kickoff: kickoffFor({
          params,
          pick,
          scout,
          others: scouts.filter((entry) => entry.name !== scout.name),
        }),
        routingProposal: null,
      };
    }),
  });
  if (started.kind !== 'started') {
    return false;
  }
  await advanceArtifactRun({
    agentId: containerId,
    phase: 'gathering',
    scoutPlan: artifactScoutPlanEntries({ picks: roster.picks, agentIds: started.childIds }),
  }).catch((error: unknown) => {
    console.warn(`[artifact-run] ${params.kind} ${containerId}: ${formatError(error)}`);
  });
  containers.set(containerId, contextFor({ params, picks: roster.picks }));
  joined.delete(containerId);
  clearDeadline({ containerId });
  deadlines.set(
    containerId,
    setTimeout(() => {
      void get().expireArtifactScouts({ sessionId, containerId });
    }, WIREFRAME_SCOUT_DEADLINE_MS),
  );
  return true;
};

export type StartWireframeScoutsParams = Readonly<{
  sessionId: SessionId;
  containerId: AgentId;
  mounts: ReadonlyArray<ArtifactRunMount>;
  fidelity: WireframeFidelity;
  target: WireframeTarget;
  workflowRunId: WorkflowRunId | null;
  brief: string | null;
  attachments: ReadonlyArray<ArtifactAttachment>;
  goal: string;
}>;

export const startWireframeScouts = (set: SetFn, get: GetFn) => {
  return async (params: StartWireframeScoutsParams): Promise<boolean> =>
    startArtifactScouts({ set, get, params: { ...params, kind: 'wireframe' } });
};

export type StartReportScoutsParams = Readonly<{
  sessionId: SessionId;
  containerId: AgentId;
  mounts: ReadonlyArray<ArtifactRunMount>;
  reportType: ReportType;
  changedMountIds: ReadonlyArray<MountId>;
  changedPaths: ReadonlyArray<string>;
  workflowRunId: WorkflowRunId | null;
  brief: string | null;
  attachments: ReadonlyArray<ArtifactAttachment>;
  goal: string;
}>;

export const startReportScouts = (set: SetFn, get: GetFn) => {
  return async (params: StartReportScoutsParams): Promise<boolean> =>
    startArtifactScouts({ set, get, params: { ...params, kind: 'report' } });
};

type ContainerParams = Readonly<{
  sessionId: SessionId;
  containerId: AgentId;
}>;

const settleChildren = async ({
  set,
  get,
  sessionId,
  containerId,
  reason,
}: Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  containerId: AgentId;
  reason: string;
}>): Promise<void> => {
  const agents = get().sessionPhaseRuns?.[sessionId] ?? [];
  const pending = childrenOf({ agents, containerId }).filter(
    (child) => !TERMINAL.includes(child.status),
  );
  if (pending.length === 0) {
    return;
  }
  for (const child of pending) {
    await get()
      .cancelCurrentTurn(sessionId, child.id)
      .catch(() => undefined);
    await invokeAgentUpdateStatus(child.id, {
      status: 'skipped',
      outputSummary: reason,
      completedAt: nowIso(),
    }).catch(() => undefined);
  }
  const refreshed = await invokeAgentList(sessionId);
  set((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
  }));
};

export const expireArtifactScouts = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, containerId }: ContainerParams): Promise<void> => {
    clearDeadline({ containerId });
    if (joined.has(containerId)) {
      return;
    }
    await settleChildren({
      set,
      get,
      sessionId,
      containerId,
      reason: WIREFRAME_SCOUT_DEADLINE_REASON,
    });
    await get().joinArtifactScouts({ sessionId, containerId });
  };
};

type VerifiedEntry = Readonly<{
  entry: WireframeScoutSectionEntry;
  agentId: AgentId | null;
  verification: CitedPathVerification | null;
}>;

const verifyReports = async ({
  agents,
  containerId,
  context,
  knownPaths,
}: Readonly<{
  agents: ReadonlyArray<Agent>;
  containerId: AgentId;
  context: ArtifactRunContext;
  knownPaths: ReadonlyArray<string>;
}>): Promise<ReadonlyArray<VerifiedEntry>> => {
  const reports = collectWireframeScoutReports({
    scouts: scoutsOf({ picks: context.picks }),
    children: childrenOf({ agents, containerId }),
  });
  const verified: Array<VerifiedEntry> = [];
  for (const [index, report] of reports.entries()) {
    if (report.state !== 'reported') {
      verified.push({
        entry: wireframeScoutSectionEntry({ report, verification: null }),
        agentId: report.agentId,
        verification: null,
      });
      continue;
    }
    const pick = context.picks[index];
    const worktreePath =
      pick === undefined
        ? ''
        : (mountOf({ mounts: context.mounts, mountId: pick.mountId })?.worktreePath ?? '');
    const verification = await verifyCitedPaths({
      paths: extractCitedPaths({ text: report.text }),
      list: ({ relPath }) => exploreList({ sessionDir: worktreePath, relPath }),
      knownPaths,
    }).catch(() => null);
    verified.push({
      entry: wireframeScoutSectionEntry({ report, verification }),
      agentId: report.agentId,
      verification,
    });
  }
  return verified;
};

const recoveredPicks = ({
  provenance,
  children,
}: Readonly<{
  provenance: ArtifactProvenance;
  children: ReadonlyArray<Agent>;
}>): ReadonlyArray<ArtifactScoutPick> =>
  provenance.scoutPlan.map((entry) => {
    const role = ARTIFACT_SCOUT_ROLES[entry.roleId as keyof typeof ARTIFACT_SCOUT_ROLES] ?? null;
    const child = children.find((agent) => agent.id === entry.agentId) ?? null;
    return {
      roleId: entry.roleId,
      mountId: entry.mountId,
      name: child?.name ?? role?.name ?? entry.roleId,
      scope: role?.scope ?? '',
      root: entry.root,
      reason: entry.reason,
    };
  });

const recoveredMounts = ({
  state,
  sessionId,
  provenance,
  picks,
}: Readonly<{
  state: ReturnType<GetFn>;
  sessionId: SessionId;
  provenance: ArtifactProvenance;
  picks: ReadonlyArray<ArtifactScoutPick>;
}>): ReadonlyArray<ArtifactRunMount> =>
  provenance.mountIds.map((mountId) => {
    const mount = selectMountById({ state, sessionId, mountId });
    return {
      mountId,
      mountName: mount?.mountName ?? '',
      root: picks.find((pick) => pick.mountId === mountId)?.root ?? '.',
      worktreePath: mount?.worktreePath ?? '',
    };
  });

const recoveredContext = ({
  state,
  sessionId,
  containerId,
  provenance,
}: Readonly<{
  state: ReturnType<GetFn>;
  sessionId: SessionId;
  containerId: AgentId;
  provenance: ArtifactProvenance;
}>): ArtifactRunContext | null => {
  const agents = state.sessionPhaseRuns?.[sessionId] ?? [];
  const container = agents.find((agent) => agent.id === containerId) ?? null;
  if (container === null) {
    return null;
  }
  const picks = recoveredPicks({
    provenance,
    children: childrenOf({ agents, containerId }),
  });
  const base = {
    sessionId,
    workflowRunId: provenance.sourceWorkflowRunId,
    brief: provenance.brief,
    attachments: [],
    hasLostAttachments: true,
    mounts: recoveredMounts({ state, sessionId, provenance, picks }),
    picks,
  };
  if (provenance.kind === 'report') {
    return {
      ...base,
      kind: 'report',
      reportType: requestedReportType({ agentName: container.name }) ?? 'change-summary',
    };
  }
  return {
    ...base,
    kind: 'wireframe',
    fidelity: requestedWireframeFidelity({ agentName: container.name }) ?? 'low',
    target: provenance.target ?? 'both',
  };
};

const settledPlan = ({
  provenance,
  picks,
}: Readonly<{
  provenance: ArtifactProvenance;
  picks: ReadonlyArray<ArtifactScoutPick>;
}>): ReadonlyArray<ArtifactScoutPlanEntry> =>
  provenance.scoutPlan.length > 0
    ? provenance.scoutPlan
    : artifactScoutPlanEntries({ picks, agentIds: [] });

const preparedPack = async ({
  context,
  state,
  session,
  containerId,
  scoutSection,
}: Readonly<{
  context: ArtifactRunContext;
  state: ReturnType<GetFn>;
  session: Parameters<typeof prepareArtifactEvidence>[0]['session'];
  containerId: AgentId;
  scoutSection: string;
}>) => {
  const shared = {
    state,
    session,
    workflowRunId: context.workflowRunId,
    brief: context.brief,
    attachments: context.attachments,
    mountIds: context.mounts.map((mount) => mount.mountId),
    executingAgentId: containerId,
  };
  if (context.kind === 'report') {
    return prepareArtifactEvidence({
      ...shared,
      kind: 'report',
      reportType: context.reportType,
      scouts: {
        names: context.picks.map((pick) => pick.name),
        section: scoutSection,
        note: null,
      },
    });
  }
  return prepareArtifactEvidence({
    ...shared,
    kind: 'wireframe',
    fidelity: context.fidelity,
    target: context.target,
    scoutSection,
  });
};

const joinArtifactScoutsFor = async ({
  set,
  get,
  sessionId,
  containerId,
}: Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  containerId: AgentId;
}>): Promise<void> => {
  if (joined.has(containerId)) {
    return;
  }
  const provenance = await loadArtifactProvenance(containerId).catch(() => null);
  if (provenance === null || provenance.phase !== 'gathering') {
    return;
  }
  const context =
    containers.get(containerId) ??
    recoveredContext({ state: get(), sessionId, containerId, provenance });
  if (context === null) {
    return;
  }
  joined.add(containerId);
  clearDeadline({ containerId });
  const state = get();
  const session = state.sessions?.find((entry) => entry.id === sessionId) ?? null;
  if (session === null) {
    return;
  }
  const agents = state.sessionPhaseRuns?.[sessionId] ?? [];
  const knownPaths =
    context.kind === 'report'
      ? ((
          await collectReportDiffEvidence({
            state,
            sessionId,
            mountIds: context.mounts.map((mount) => mount.mountId),
          }).catch(() => null)
        )?.paths ?? [])
      : [];
  const verified = await verifyReports({ agents, containerId, context, knownPaths });
  set((current) => {
    const next = { ...current.wireframeScoutVerification };
    for (const row of verified) {
      if (row.agentId === null || row.verification === null) {
        continue;
      }
      next[row.agentId] = {
        verified: row.verification.verified.length,
        cited: row.verification.cited,
      };
    }
    return { wireframeScoutVerification: next };
  });
  const plan = settledPlan({ provenance, picks: context.picks });
  await advanceArtifactRun({ agentId: containerId, phase: 'producing', scoutPlan: plan }).catch(
    (error: unknown) => {
      console.warn(`[artifact-run] ${context.kind} ${containerId}: ${formatError(error)}`);
    },
  );
  const prepared = await preparedPack({
    context,
    state: get(),
    session,
    containerId,
    scoutSection: wireframeScoutSection({
      root: context.mounts.map((mount) => mount.root).join(', '),
      entries: verified.map((row) => row.entry),
    }),
  });
  await recordArtifactProvenance({
    ...prepared.provenance,
    omissions: context.hasLostAttachments
      ? [...prepared.provenance.omissions, ARTIFACT_RUN_LOST_ATTACHMENTS_NOTE]
      : prepared.provenance.omissions,
    phase: 'producing',
    scoutPlan: plan,
    mountIds: provenance.mountIds,
    target: provenance.target,
    deadlineAt: null,
    agentId: containerId,
    executingWorkflowRunId: null,
  }).catch((error: unknown) => {
    console.warn(`[artifact-provenance] ${context.kind} ${containerId}: ${formatError(error)}`);
  });
  containers.delete(containerId);
  openTurnStartWindow({ agentId: containerId });
  void get().sendTurn({ sessionId, agentId: containerId, content: prepared.text });
};

export const joinArtifactScouts = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, containerId }: ContainerParams): Promise<void> =>
    joinArtifactScoutsFor({ set, get, sessionId, containerId });
};

export const stopArtifactGeneration = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId }: Readonly<{ sessionId: SessionId; agentId: AgentId }>) => {
    clearDeadline({ containerId: agentId });
    joined.add(agentId);
    containers.delete(agentId);
    const provenance = await loadArtifactProvenance(agentId).catch(() => null);
    if (provenance !== null && provenance.phase === 'gathering') {
      await advanceArtifactRun({
        agentId,
        phase: 'failed',
        scoutPlan: provenance.scoutPlan,
      }).catch((error: unknown) => {
        console.warn(`[artifact-run] ${provenance.kind} ${agentId}: ${formatError(error)}`);
      });
    }
    const agents = get().sessionPhaseRuns?.[sessionId] ?? [];
    for (const child of childrenOf({ agents, containerId: agentId })) {
      if (TERMINAL.includes(child.status)) {
        continue;
      }
      await get()
        .cancelCurrentTurn(sessionId, child.id)
        .catch(() => undefined);
      await invokeAgentUpdateStatus(child.id, {
        status: 'skipped',
        outputSummary: WIREFRAME_SCOUT_STOP_REASON,
        completedAt: nowIso(),
      }).catch(() => undefined);
    }
    await get()
      .cancelCurrentTurn(sessionId, agentId)
      .catch(() => undefined);
    const refreshed = await invokeAgentList(sessionId).catch(() => null);
    if (refreshed !== null) {
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
      }));
    }
  };
};

const isStalledContainer = ({ container }: Readonly<{ container: Agent }>): boolean =>
  RECOVERABLE_KINDS.includes(container.kind) &&
  container.deletedAt == null &&
  !TERMINAL.includes(container.status);

const rearmDeadline = ({
  get,
  sessionId,
  containerId,
  deadlineAt,
}: Readonly<{
  get: GetFn;
  sessionId: SessionId;
  containerId: AgentId;
  deadlineAt: number | null;
}>): void => {
  clearDeadline({ containerId });
  const remaining =
    deadlineAt === null ? WIREFRAME_SCOUT_DEADLINE_MS : Math.max(0, deadlineAt - Date.now());
  deadlines.set(
    containerId,
    setTimeout(() => {
      void get().expireArtifactScouts({ sessionId, containerId });
    }, remaining),
  );
};

export const recoverArtifactScouts = (set: SetFn, get: GetFn) => {
  return async ({ sessionId }: Readonly<{ sessionId: SessionId }>): Promise<void> => {
    const agents = get().sessionPhaseRuns?.[sessionId] ?? [];
    const stalled = agents.filter(
      (agent) =>
        isStalledContainer({ container: agent }) &&
        !containers.has(agent.id) &&
        childrenOf({ agents, containerId: agent.id }).length > 0,
    );
    if (stalled.length === 0) {
      return;
    }
    let isAbandoned = false;
    for (const container of stalled) {
      const provenance = await loadArtifactProvenance(container.id).catch(() => null);
      if (provenance !== null && provenance.phase === 'gathering') {
        const children = childrenOf({ agents, containerId: container.id });
        const isSettled = children.every((child) => TERMINAL.includes(child.status));
        if (isSettled) {
          await get().joinArtifactScouts({ sessionId, containerId: container.id });
          continue;
        }
        rearmDeadline({
          get,
          sessionId,
          containerId: container.id,
          deadlineAt: provenance.deadlineAt,
        });
        continue;
      }
      isAbandoned = true;
      await settleChildren({
        set,
        get,
        sessionId,
        containerId: container.id,
        reason: WIREFRAME_SCOUT_RESTART_REASON,
      });
      await invokeAgentUpdateStatus(container.id, {
        status: 'failed',
        outputSummary: artifactRunRestartSummary({
          kind: container.kind === 'report' ? 'report' : 'wireframe',
        }),
        completedAt: nowIso(),
      }).catch(() => undefined);
    }
    if (!isAbandoned) {
      return;
    }
    const refreshed = await invokeAgentList(sessionId).catch(() => null);
    if (refreshed !== null) {
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
      }));
    }
  };
};
