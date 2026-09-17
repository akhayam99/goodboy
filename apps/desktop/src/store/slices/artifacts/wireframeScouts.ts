import type { Agent, AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { ArtifactAttachment } from '../../../features/artifacts/artifactAttachments';
import { recordArtifactProvenance } from '../../../features/artifacts/artifactProvenance';
import {
  extractCitedPaths,
  verifyCitedPaths,
  type CitedPathVerification,
} from '../../../features/artifacts/citedPaths';
import { prepareArtifactEvidence } from '../../../features/artifacts/prepareArtifactEvidence';
import { exploreList } from '../../../features/explore/explore';
import type { WireframeFidelity } from '../../../features/wireframes/wireframeFidelity';
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
  WIREFRAME_SCOUTS,
} from '../../../features/wireframes/wireframeScoutRoles';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { startFanOutChildren } from '../workflows/scoutTree';
import { openTurnStartWindow } from '../turn/turnStartWindow';
import type { GetFn, SetFn } from './types';

export const WIREFRAME_SCOUT_RESTART_SUMMARY =
  'the app restarted before the scouts finished, so this wireframe was never written. try again.';

type WireframeScoutContainer = Readonly<{
  sessionId: SessionId;
  fidelity: WireframeFidelity;
  target: WireframeTarget;
  workflowRunId: WorkflowRunId | null;
  brief: string | null;
  attachments: ReadonlyArray<ArtifactAttachment>;
  root: string;
  worktreePath: string;
}>;

const containers = new Map<AgentId, WireframeScoutContainer>();
const deadlines = new Map<AgentId, ReturnType<typeof setTimeout>>();
const joined = new Set<AgentId>();

export const resetWireframeScoutRegistry = (): void => {
  for (const handle of deadlines.values()) {
    clearTimeout(handle);
  }
  containers.clear();
  deadlines.clear();
  joined.clear();
};

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const TERMINAL: ReadonlyArray<Agent['status']> = ['completed', 'failed', 'skipped'];

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

type StartParams = Readonly<{
  sessionId: SessionId;
  containerId: AgentId;
  root: string;
  worktreePath: string;
  fidelity: WireframeFidelity;
  target: WireframeTarget;
  workflowRunId: WorkflowRunId | null;
  brief: string | null;
  attachments: ReadonlyArray<ArtifactAttachment>;
  goal: string;
}>;

export const startWireframeScouts = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    containerId,
    root,
    worktreePath,
    fidelity,
    target,
    workflowRunId,
    brief,
    attachments,
    goal,
  }: StartParams): Promise<boolean> => {
    const agents = get().sessionPhaseRuns?.[sessionId] ?? [];
    const container = agents.find((agent) => agent.id === containerId) ?? null;
    if (container === null) {
      return false;
    }
    const started = await startFanOutChildren({
      set,
      get,
      sessionId,
      container,
      role: 'scout',
      childKind: 'scout',
      specs: WIREFRAME_SCOUTS.map((scout) => ({
        name: scout.name,
        promptText: `${scout.name}\n${scout.scope}`,
        kickoff: composeWireframeScoutKickoff({
          scout,
          others: WIREFRAME_SCOUTS.filter((entry) => entry.id !== scout.id),
          root,
          goal,
          brief,
        }),
        routingProposal: null,
      })),
    });
    if (started.kind !== 'started') {
      return false;
    }
    containers.set(containerId, {
      sessionId,
      fidelity,
      target,
      workflowRunId,
      brief,
      attachments,
      root,
      worktreePath,
    });
    joined.delete(containerId);
    clearDeadline({ containerId });
    deadlines.set(
      containerId,
      setTimeout(() => {
        void get().expireWireframeScouts({ sessionId, containerId });
      }, WIREFRAME_SCOUT_DEADLINE_MS),
    );
    return true;
  };
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

export const expireWireframeScouts = (set: SetFn, get: GetFn) => {
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
    await get().joinWireframeScouts({ sessionId, containerId });
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
  worktreePath,
}: Readonly<{
  agents: ReadonlyArray<Agent>;
  containerId: AgentId;
  worktreePath: string;
}>): Promise<ReadonlyArray<VerifiedEntry>> => {
  const reports = collectWireframeScoutReports({
    scouts: WIREFRAME_SCOUTS,
    children: childrenOf({ agents, containerId }),
  });
  const verified: Array<VerifiedEntry> = [];
  for (const report of reports) {
    if (report.state !== 'reported') {
      verified.push({
        entry: wireframeScoutSectionEntry({ report, verification: null }),
        agentId: report.agentId,
        verification: null,
      });
      continue;
    }
    const verification = await verifyCitedPaths({
      paths: extractCitedPaths({ text: report.text }),
      list: ({ relPath }) => exploreList({ sessionDir: worktreePath, relPath }),
    }).catch(() => null);
    verified.push({
      entry: wireframeScoutSectionEntry({ report, verification }),
      agentId: report.agentId,
      verification,
    });
  }
  return verified;
};

export const joinWireframeScouts = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, containerId }: ContainerParams): Promise<void> => {
    if (joined.has(containerId)) {
      return;
    }
    const context = containers.get(containerId) ?? null;
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
    const verified = await verifyReports({
      agents,
      containerId,
      worktreePath: context.worktreePath,
    });
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
    const prepared = await prepareArtifactEvidence({
      kind: 'wireframe',
      fidelity: context.fidelity,
      target: context.target,
      state: get(),
      session,
      workflowRunId: context.workflowRunId,
      brief: context.brief,
      attachments: context.attachments,
      executingAgentId: containerId,
      scoutSection: wireframeScoutSection({
        root: context.root,
        entries: verified.map((row) => row.entry),
      }),
    });
    await recordArtifactProvenance({
      ...prepared.provenance,
      agentId: containerId,
      executingWorkflowRunId: null,
    }).catch((error: unknown) => {
      console.warn(`[artifact-provenance] wireframe ${containerId}: ${formatError(error)}`);
    });
    containers.delete(containerId);
    openTurnStartWindow({ agentId: containerId });
    void get().sendTurn({ sessionId, agentId: containerId, content: prepared.text });
  };
};

export const stopArtifactGeneration = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId }: Readonly<{ sessionId: SessionId; agentId: AgentId }>) => {
    clearDeadline({ containerId: agentId });
    joined.add(agentId);
    containers.delete(agentId);
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
  container.kind === 'wireframe' &&
  container.deletedAt == null &&
  !TERMINAL.includes(container.status);

export const recoverWireframeScouts = (set: SetFn, get: GetFn) => {
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
    for (const container of stalled) {
      await settleChildren({
        set,
        get,
        sessionId,
        containerId: container.id,
        reason: WIREFRAME_SCOUT_RESTART_REASON,
      });
      await invokeAgentUpdateStatus(container.id, {
        status: 'failed',
        outputSummary: WIREFRAME_SCOUT_RESTART_SUMMARY,
        completedAt: nowIso(),
      }).catch(() => undefined);
    }
    const refreshed = await invokeAgentList(sessionId).catch(() => null);
    if (refreshed !== null) {
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
      }));
    }
  };
};
