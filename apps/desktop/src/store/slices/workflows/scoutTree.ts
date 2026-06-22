import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { extractScoutSplit, type ExtractedScoutArea } from '@goodboy/core';
import {
  invokeAgentInsert,
  invokeAgentList,
  invokeAgentUpdateStatus,
} from '../../../features/workflows/workflows';
import {
  AGENT_KIND_DEFAULTS,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../features/session/agent-kind';
import type { GetFn, SetFn } from './types';

export const SCOUT_DEPTH_CAP = 2;
export const SCOUT_MAX_CHILDREN = 6;

function resolveContainerModel(get: GetFn, container: Agent): string {
  const override = get().agentModelOverride[container.id];
  if (override) {
    return override;
  }
  if (container.modelOverride) {
    return container.modelOverride;
  }
  const kind = (container.kind as AgentKind | undefined) ?? inferAgentKindFromName(container.name);
  return AGENT_KIND_DEFAULTS[kind]?.model ?? AGENT_KIND_DEFAULTS.scout.model;
}

const synthesisStarted = new Set<string>();
const selfExploreTasked = new Set<string>();

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const TERMINAL: ReadonlyArray<Agent['status']> = ['completed', 'failed', 'skipped'];

function childrenOf(runs: ReadonlyArray<Agent>, parentId: AgentId): ReadonlyArray<Agent> {
  return runs.filter((r) => r.parentAgentId === parentId).sort((a, b) => a.ordinal - b.ordinal);
}

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

function composeScoutKickoff(area: ExtractedScoutArea, depth: number): string {
  const canSplit = depth < SCOUT_DEPTH_CAP;
  return [
    'You are a scout exploring ONE area of a larger search, running in parallel with sibling scouts.',
    `Area: ${area.area}`,
    `Objective: ${area.query}`,
    '',
    'Read ONLY what this area needs. Never edit files. Report your findings concisely in this single turn.',
    canSplit
      ? 'If this area is itself too broad, you MAY fan out further: emit on its own line <<scout-split>> followed by a JSON array of {"area","query"} (2 to 6 entries), then <</scout-split>>.'
      : 'You are at maximum split depth. Do not fan out further: read your scope and summarize directly.',
  ].join('\n');
}

function composeSelfExploreKickoff(areas: ReadonlyArray<ExtractedScoutArea>): string {
  const list = areas.map((a) => `- ${a.area}: ${a.query}`).join('\n');
  return [
    'Multi-scout fan-out is disabled for this workspace, so do NOT split.',
    'Explore all of these areas yourself in this turn and report one consolidated finding:',
    list,
  ].join('\n');
}

function scoutFanoutEnabled(get: GetFn, sessionId: SessionId): boolean {
  const session = get().sessions.find((s) => s.id === sessionId);
  if (!session) {
    return false;
  }
  return get().workspaceOverrides[session.workspaceId]?.scoutFanout === true;
}

function emitScoutFanoutNudge(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  agentId: AgentId,
  areaCount: number,
): void {
  const session = get().sessions.find((s) => s.id === sessionId);
  if (!session) {
    return;
  }
  set((s) => ({
    sessionNudges: {
      ...s.sessionNudges,
      [sessionId]: {
        kind: 'scout-fanout-suggested' as const,
        id: crypto.randomUUID(),
        agentId,
        workspaceId: session.workspaceId,
        areaCount,
      },
    },
  }));
}

function composeSynthesisKickoff(containerName: string, children: ReadonlyArray<Agent>): string {
  const blocks = children
    .map((c) => `[${c.name}] (${c.status})\n${c.outputSummary ?? '(no findings reported)'}`)
    .join('\n\n');
  return [
    `Your sub-scouts for "${containerName}" finished. Consolidate their findings into ONE report.`,
    'Do NOT re-read the repo: synthesize only from the summaries below.',
    '',
    blocks,
  ].join('\n');
}

function activateAgent(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  agentId: AgentId,
  content: string,
  select: boolean,
): void {
  set((s) => ({
    ...(select && { selectedAgentId: { ...s.selectedAgentId, [sessionId]: agentId } }),
    agentTurnState: {
      ...s.agentTurnState,
      [agentId]: { kind: 'idle' as const, lastActivityAt: nowIso() },
    },
  }));
  void get().sendTurn({ sessionId, agentId, content });
}

export const fanOutScouts = async (
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  container: Agent,
  areas: ReadonlyArray<ExtractedScoutArea>,
): Promise<void> => {
  const clamped = areas.slice(0, SCOUT_MAX_CHILDREN);
  const dropped = areas.length - clamped.length;
  if (dropped > 0) {
    void get().emitNotification(
      'agent-auto-spawn',
      'info',
      `scout fan-out capped: ${container.name}`,
      `dropped ${dropped} area(s) over the ${SCOUT_MAX_CHILDREN}-child limit`,
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
      kind: 'scout',
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
      agentKindOverride[id] = 'scout';
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
    activateAgent(
      set,
      get,
      sessionId,
      childIds[i]!,
      composeScoutKickoff(clamped[i]!, childDepth),
      false,
    );
  }
};

async function maybeSynthesizeParent(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  childId: AgentId,
): Promise<void> {
  const runs = get().sessionPhaseRuns[sessionId] ?? [];
  const child = runs.find((r) => r.id === childId);
  const parentId = child?.parentAgentId;
  if (!parentId) {
    void get().refreshUnreadWorkspaces();
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
  activateAgent(
    set,
    get,
    sessionId,
    parentId,
    composeSynthesisKickoff(container.name, siblings),
    false,
  );
}

async function settleScout(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  agentId: AgentId,
  summary: string,
): Promise<void> {
  await invokeAgentUpdateStatus(agentId, {
    status: 'completed',
    outputSummary: summary,
    completedAt: nowIso(),
  });
  const refreshed = await invokeAgentList(sessionId);
  set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
  await maybeSynthesizeParent(set, get, sessionId, agentId);
}

export const advanceScoutTree = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId, assistantText: string): Promise<void> => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = runs.find((r) => r.id === agentId);
    if (!agent) {
      return;
    }

    const split = extractScoutSplit(assistantText);
    if (split != null && split.length >= 2 && scoutDepth(runs, agentId) < SCOUT_DEPTH_CAP) {
      if (scoutFanoutEnabled(get, sessionId)) {
        await fanOutScouts(set, get, sessionId, agent, split);
        return;
      }
      if (agent.parentAgentId == null && !selfExploreTasked.has(agentId)) {
        selfExploreTasked.add(agentId);
        emitScoutFanoutNudge(set, get, sessionId, agentId, split.length);
        activateAgent(set, get, sessionId, agentId, composeSelfExploreKickoff(split), true);
        return;
      }
    }

    await settleScout(set, get, sessionId, agentId, assistantText.slice(0, 2000));
  };
};
