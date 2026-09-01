import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, PlanId, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  recordOutcome: vi.fn(async () => undefined),
}));

vi.mock('./recordOutcome', () => ({ recordOutcome: h.recordOutcome }));

import { acceptSessionNudgeHandoff } from './acceptSessionNudgeHandoff';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'sess-1' as SessionId;
const PLAN_ID = 'plan-1' as PlanId;
const SOURCE_AGENT_ID = 'agent-source' as AgentId;

type FakeState = {
  sessionNudges: Record<string, unknown>;
  spawnAgent: ReturnType<typeof vi.fn>;
};

const buildAccept = (state: FakeState) => {
  const set = ((updater: (s: FakeState) => Partial<FakeState>) => {
    Object.assign(state, updater(state));
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return acceptSessionNudgeHandoff(set, get);
};

const buildState = (nudge: unknown): FakeState => ({
  sessionNudges: { [SESSION_ID]: nudge },
  spawnAgent: vi.fn(async () => 'agent-impl' as AgentId),
});

beforeEach(() => {
  h.recordOutcome.mockClear();
});

describe('acceptSessionNudgeHandoff, spawning does not steal focus', () => {
  it('spawns the plan implementer without focus and hands back the agent to open', async () => {
    const state = buildState({
      id: 'nudge-1',
      kind: 'plan-ready',
      agentId: SOURCE_AGENT_ID,
      planId: PLAN_ID,
    });

    const agentId = await buildAccept(state)(SESSION_ID);

    expect(state.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      triggeredPlanId: PLAN_ID,
      kindOverride: 'implementer',
      parentAgentId: SOURCE_AGENT_ID,
      focus: 'none',
    });
    expect(agentId).toBe('agent-impl');
  });

  it('spawns a planless implementer without focus', async () => {
    const state = buildState({
      id: 'nudge-2',
      kind: 'plan-ready',
      agentId: SOURCE_AGENT_ID,
      planId: null,
    });

    await buildAccept(state)(SESSION_ID);

    expect(state.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'implementer',
      parentAgentId: SOURCE_AGENT_ID,
      focus: 'none',
    });
  });

  it('spawns the suggested handoff target without focus', async () => {
    const state = buildState({
      id: 'nudge-3',
      kind: 'handoff-suggested',
      agentId: SOURCE_AGENT_ID,
      targetKind: 'reviewer',
      planId: null,
    });

    const agentId = await buildAccept(state)(SESSION_ID);

    expect(state.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'reviewer',
      parentAgentId: SOURCE_AGENT_ID,
      focus: 'none',
    });
    expect(agentId).toBe('agent-impl');
  });

  it('hands back nothing when there is no nudge to accept', async () => {
    const state: FakeState = { sessionNudges: {}, spawnAgent: vi.fn(async () => 'x' as AgentId) };

    const agentId = await buildAccept(state)(SESSION_ID);

    expect(agentId).toBeNull();
    expect(state.spawnAgent).not.toHaveBeenCalled();
  });
});
