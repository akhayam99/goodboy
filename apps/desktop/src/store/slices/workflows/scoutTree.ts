import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import {
  extractFanOut,
  fanOutCapabilityForRole,
  fallbackStepOutputSummary,
  type ExtractedFanOutArea,
} from '@goodboy/core';
import {
  invokeAgentInsert,
  invokeAgentList,
  invokeAgentUpdateStatus,
} from '../../../features/workflows/workflows';
import { worktreeChangedFiles } from '../../../features/worktree/worktree';
import {
  KIND_TO_ROLE,
  kindRouting,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { roleModelsForSession } from '../overrides/roleModelsForSession';
import type { GetFn, SetFn } from './types';

export const SCOUT_DEPTH_CAP = 2;
export const FAN_OUT_DEPTH_CAP = 1;
export const FAN_OUT_MAX_CHILDREN = 4;
export const SCOUT_MAX_CHILDREN = FAN_OUT_MAX_CHILDREN;

const resolveContainerModel = (get: GetFn, container: Agent): string => {
  const override = get().agentModelOverride[container.id];
  if (override) {
    return override;
  }
  if (container.modelOverride) {
    return container.modelOverride;
  }
  const kind = (container.kind as AgentKind | undefined) ?? inferAgentKindFromName(container.name);
  const roleModels = roleModelsForSession({ state: get(), sessionId: container.sessionId });
  return kindRouting({ kind, roleModels }).model;
};

const synthesisStarted = new Set<string>();
const selfExploreTasked = new Set<string>();

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const TERMINAL: ReadonlyArray<Agent['status']> = ['completed', 'failed', 'skipped'];

const childrenOf = (runs: ReadonlyArray<Agent>, parentId: AgentId): ReadonlyArray<Agent> => {
  return runs.filter((r) => r.parentAgentId === parentId).sort((a, b) => a.ordinal - b.ordinal);
};

export const scoutDepth = (runs: ReadonlyArray<Agent>, agentId: AgentId): number => {
  const seen = new Set<AgentId>();
  let depth = 0;
  let cur = runs.find((r) => r.id === agentId);
  while (cur?.parentAgentId && !seen.has(cur.id)) {
    seen.add(cur.id);
    depth += 1;
    const parentId = cur.parentAgentId;
    cur = runs.find((r) => r.id === parentId);
  }
  return depth;
};

const resolveAgentKind = (agent: Agent): AgentKind => {
  const persisted = agent.kind as AgentKind | undefined;
  return persisted ?? inferAgentKindFromName(agent.name);
};

const resolveAgentRole = (agent: Agent): string => {
  return KIND_TO_ROLE[resolveAgentKind(agent)] ?? 'custom';
};

const depthCapForRole = (role: string): number => {
  if (role === 'scout') {
    return SCOUT_DEPTH_CAP;
  }
  return FAN_OUT_DEPTH_CAP;
};

const fanOutEnabled = (get: GetFn, sessionId: SessionId): boolean => {
  const session = get().sessions.find((s) => s.id === sessionId);
  if (!session) {
    return false;
  }
  return get().workspaceOverrides[session.workspaceId]?.parallelAgents === true;
};

const composeChildKickoff = ({
  role,
  area,
  depth,
}: {
  readonly role: string;
  readonly area: ExtractedFanOutArea;
  readonly depth: number;
}): string => {
  if (role === 'scout') {
    const canSplit = depth < SCOUT_DEPTH_CAP;
    return [
      `**Area** ${area.area} (one of several scouts running in parallel)`,
      `**Find** ${area.query}`,
      canSplit
        ? '**Split** allowed via `<<fan-out>>` if this area is still too broad.'
        : '**Split** not allowed, you are at max depth. Read your scope and summarize.',
      '**End with** `<<scout-domains keywords="auth,db,routing">>`, 2 to 4 single-word keywords, no prose.',
    ].join('\n');
  }
  if (role === 'reviewer') {
    return [
      `**Aspect** ${area.area} (one of several reviewers running in parallel)`,
      `**Audit** ${area.query}`,
      '**Fan-out condition** large diff gate already met in runtime.',
      '**Scope** read the full diff through this lens. Never shard by file and never split again.',
    ].join('\n');
  }
  if (role === 'tester') {
    return [
      `**Module under test** ${area.area} (one of several testers running in parallel)`,
      `**Tests to write** ${area.query}`,
      '**Fan-out condition** disjoint module and fixture gate already met in runtime.',
      '**Fixture conventions** reuse existing fixtures first, use one helper style, and keep one test file for this module.',
      '**Scope** do not split again.',
    ].join('\n');
  }
  if (role === 'investigator') {
    return [
      `**Failure group** ${area.area} (one of several investigators running in parallel)`,
      `**Root-cause target** ${area.query}`,
      '**Fan-out condition** independent stack-frame gate already met in runtime.',
      '**Scope** treat only this independent failure group. Do not split again.',
    ].join('\n');
  }
  return [`**Area** ${area.area}`, `**Task** ${area.query}`, '**Scope** do not split again.'].join(
    '\n',
  );
};

const composeSelfExploreKickoff = ({
  role,
  areas,
  reason,
}: {
  readonly role: string;
  readonly areas: ReadonlyArray<ExtractedFanOutArea>;
  readonly reason: string;
}): string => {
  const list = areas.map((a) => `- ${a.area}: ${a.query}`).join('\n');
  if (role === 'scout') {
    return [
      `**Explore yourself** ${reason}. Do not split. Cover every area below in this turn and report one consolidated finding.`,
      list,
    ].join('\n');
  }
  if (role === 'reviewer') {
    return [
      `**Review yourself** ${reason}. Do not split. Read the full diff and return one consolidated review across all lenses below.`,
      list,
    ].join('\n');
  }
  if (role === 'tester') {
    return [
      `**Test yourself** ${reason}. Do not split. Write one coherent test artifact and keep fixture conventions consistent across all modules below.`,
      list,
    ].join('\n');
  }
  if (role === 'investigator') {
    return [
      `**Investigate yourself** ${reason}. Do not split. Build one coherent hypothesis chain across the failure groups below.`,
      list,
    ].join('\n');
  }
  return [`**Continue yourself** ${reason}. Do not split.`, list].join('\n');
};

const composeSynthesisKickoff = ({
  role,
  containerName,
  children,
}: {
  readonly role: string;
  readonly containerName: string;
  readonly children: ReadonlyArray<Agent>;
}): string => {
  const blocks = children
    .map((c) => `[${c.name}] (${c.status})\n${c.outputSummary ?? '(no findings reported)'}`)
    .join('\n\n');
  const seamRule =
    role === 'reviewer'
      ? '**Merge rule** reconcile overlap, keep one severity scale, and preserve cross-file findings.'
      : role === 'tester'
        ? '**Merge rule** reconcile fixture style, helper naming, and assertion style into one coherent artifact.'
        : role === 'investigator'
          ? '**Merge rule** collapse duplicate symptoms that share a root cause, keep only independent failures separate.'
          : '**Merge rule** resolve overlaps and contradictions explicitly while producing one coherent artifact.';
  return [
    `**Consolidate** the sub-agent findings for "${containerName}" into one output, from the summaries below only.`,
    seamRule,
    '',
    blocks,
  ].join('\n');
};

const activateAgent = ({
  set,
  get,
  sessionId,
  agentId,
  content,
  select,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly content: string;
  readonly select: boolean;
}): void => {
  set((s) => ({
    ...(select && { selectedAgentId: { ...s.selectedAgentId, [sessionId]: agentId } }),
    agentTurnState: {
      ...s.agentTurnState,
      [agentId]: { kind: 'idle' as const, lastActivityAt: nowIso() },
    },
  }));
  void get().sendTurn({ sessionId, agentId, content });
};

const areDisjointModules = (modules: ReadonlyArray<string>): boolean => {
  const normalized = modules
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== '');
  if (normalized.length < 2) {
    return false;
  }
  const set = new Set(normalized);
  if (set.size !== normalized.length) {
    return false;
  }
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const left = normalized[i]!;
      const right = normalized[j]!;
      if (left.startsWith(`${right}/`) || right.startsWith(`${left}/`)) {
        return false;
      }
    }
  }
  return true;
};

const hasDisjointFixtures = (areas: ReadonlyArray<ExtractedFanOutArea>): boolean => {
  const seen = new Set<string>();
  for (const area of areas) {
    for (const fixture of area.fixtures) {
      const key = fixture.trim().toLowerCase();
      if (key === '') {
        continue;
      }
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
    }
  }
  return true;
};

const canFanOutByRole = async ({
  get,
  sessionId,
  role,
  areas,
}: {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly role: string;
  readonly areas: ReadonlyArray<ExtractedFanOutArea>;
}): Promise<boolean> => {
  if (role === 'scout') {
    return true;
  }
  if (role === 'reviewer') {
    const worktreePath = get().sessionWorktrees[sessionId]?.[0];
    if (worktreePath == null) {
      return false;
    }
    try {
      const changed = await worktreeChangedFiles(worktreePath);
      const diffLines = changed.additions + changed.deletions;
      return changed.paths.length > 15 || diffLines > 800;
    } catch {
      return false;
    }
  }
  if (role === 'tester') {
    const modules = areas.map((area) => area.module ?? area.area);
    return areDisjointModules(modules) && hasDisjointFixtures(areas);
  }
  if (role === 'investigator') {
    const topFrames = areas
      .map((area) => area.topFrame)
      .filter((value): value is string => value != null);
    if (topFrames.length < 2 || topFrames.length !== areas.length) {
      return false;
    }
    if (new Set(topFrames).size !== topFrames.length) {
      return false;
    }
    return areas.every((area) => area.sharedFrames.length === 0);
  }
  return false;
};

const fanOutAgents = async ({
  set,
  get,
  sessionId,
  container,
  areas,
  role,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly container: Agent;
  readonly areas: ReadonlyArray<ExtractedFanOutArea>;
  readonly role: string;
}): Promise<void> => {
  const clamped = areas.slice(0, FAN_OUT_MAX_CHILDREN);
  const dropped = areas.length - clamped.length;
  if (dropped > 0) {
    void get().emitNotification(
      'agent-auto-spawn',
      'info',
      `agent fan-out capped: ${container.name}`,
      `dropped ${dropped} area(s) over the ${FAN_OUT_MAX_CHILDREN}-child limit`,
      { sessionId },
    );
  }
  if (clamped.length < 2) {
    return;
  }

  synthesisStarted.delete(container.id);
  await invokeAgentUpdateStatus(container.id, { status: 'running' });

  const runs = get().sessionPhaseRuns[sessionId] ?? [];
  const childDepth = scoutDepth(runs, container.id) + 1;
  const childKind = resolveAgentKind(container);
  const childModel = resolveContainerModel(get, container);
  const baseOrdinal = runs.reduce((m, r) => Math.max(m, r.ordinal), -1) + 1;

  const childIds: AgentId[] = [];
  for (let i = 0; i < clamped.length; i++) {
    const inserted = await invokeAgentInsert({
      sessionId,
      parentAgentId: container.id,
      ordinal: baseOrdinal + i,
      name: clamped[i]!.area,
      status: 'pending',
      kind: childKind,
      ...(container.workflowRunId != null && { workflowRunId: container.workflowRunId }),
    });
    childIds.push(inserted.id);
  }

  const refreshed = await invokeAgentList(sessionId);
  set((s) => {
    const transcripts = { ...s.transcripts };
    const agentTurnState = { ...s.agentTurnState };
    const agentKindOverride = { ...s.agentKindOverride };
    const agentModelOverride = { ...s.agentModelOverride };
    for (const id of childIds) {
      transcripts[id] = transcripts[id] ?? [];
      agentTurnState[id] = { kind: 'idle', lastActivityAt: nowIso() };
      agentKindOverride[id] = childKind;
      agentModelOverride[id] = childModel;
    }
    return {
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
      transcripts,
      agentTurnState,
      agentKindOverride,
      agentModelOverride,
    };
  });

  for (let i = 0; i < childIds.length; i++) {
    activateAgent({
      set,
      get,
      sessionId,
      agentId: childIds[i]!,
      content: composeChildKickoff({ role, area: clamped[i]!, depth: childDepth }),
      select: false,
    });
  }
};

export const fanOutScouts = async (
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  container: Agent,
  areas: ReadonlyArray<ExtractedFanOutArea>,
): Promise<void> => {
  await fanOutAgents({ set, get, sessionId, container, areas, role: 'scout' });
};

const maybeSynthesizeParent = async ({
  set,
  get,
  sessionId,
  childId,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly childId: AgentId;
}): Promise<void> => {
  const runs = get().sessionPhaseRuns[sessionId] ?? [];
  const child = runs.find((r) => r.id === childId);
  const parentId = child?.parentAgentId;
  if (!parentId) {
    return;
  }

  const siblings = childrenOf(runs, parentId);
  if (siblings.some((s) => !TERMINAL.includes(s.status))) {
    return;
  }
  if (synthesisStarted.has(parentId)) {
    return;
  }
  synthesisStarted.add(parentId);

  const container = runs.find((r) => r.id === parentId);
  if (!container) {
    return;
  }
  activateAgent({
    set,
    get,
    sessionId,
    agentId: parentId,
    content: composeSynthesisKickoff({
      role: resolveAgentRole(container),
      containerName: container.name,
      children: siblings,
    }),
    select: false,
  });
};

const settleAgent = async ({
  set,
  get,
  sessionId,
  agentId,
  summary,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly summary: string;
}): Promise<void> => {
  await invokeAgentUpdateStatus(agentId, {
    status: 'completed',
    outputSummary: summary,
    completedAt: nowIso(),
  });
  const refreshed = await invokeAgentList(sessionId);
  set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
  void get().refreshUnreadWorkspaces();
  await maybeSynthesizeParent({ set, get, sessionId, childId: agentId });
};

export const advanceScoutTree = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId, assistantText: string): Promise<void> => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = runs.find((r) => r.id === agentId);
    if (!agent) {
      return;
    }

    const role = resolveAgentRole(agent);
    const capability = fanOutCapabilityForRole(role);
    const split = extractFanOut(assistantText);
    const roleDepthCap = depthCapForRole(role);
    if (
      split != null &&
      split.length >= 2 &&
      capability.mode !== 'never' &&
      scoutDepth(runs, agentId) < roleDepthCap
    ) {
      const conditionMet =
        capability.mode === 'natural'
          ? true
          : await canFanOutByRole({ get, sessionId, role, areas: split });
      if (conditionMet && fanOutEnabled(get, sessionId)) {
        await fanOutAgents({ set, get, sessionId, container: agent, areas: split, role });
        return;
      }
      if (agent.parentAgentId == null && !selfExploreTasked.has(agentId)) {
        selfExploreTasked.add(agentId);
        const reason =
          !fanOutEnabled(get, sessionId) && conditionMet
            ? 'parallel agents is off for this workspace'
            : 'this task does not meet the fan-out condition for this role';
        activateAgent({
          set,
          get,
          sessionId,
          agentId,
          content: composeSelfExploreKickoff({ role, areas: split, reason }),
          select: true,
        });
        return;
      }
    }

    await settleAgent({
      set,
      get,
      sessionId,
      agentId,
      summary: fallbackStepOutputSummary({ output: assistantText }),
    });
  };
};
