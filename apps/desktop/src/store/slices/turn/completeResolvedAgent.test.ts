import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { buildResolutionReplyBody } from '../github/buildResolutionReplyBody';
import type { ResolverThreadOutcome } from '../../types';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  invokeAgentList: vi.fn(async () => [] as ReadonlyArray<Agent>),
  invokeAgentUpdateStatus: vi.fn(async () => undefined),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.invokeAgentList,
  invokeAgentUpdateStatus: h.invokeAgentUpdateStatus,
}));

import { completeResolvedAgent } from './completeResolvedAgent';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const NOW = '2026-07-30T00:00:00.000Z' as IsoDateTime;

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'resolver',
  kind: 'resolver',
  status: 'running',
};

type Harness = {
  readonly state: {
    sessionPhaseRuns: Record<SessionId, ReadonlyArray<Agent>>;
    agentKindOverride: Record<AgentId, never>;
    resolverState: Record<AgentId, string>;
    resolverThreadOutcomes: Record<AgentId, Record<string, ResolverThreadOutcome>>;
    refreshUnreadWorkspaces: ReturnType<typeof vi.fn>;
    activateNextResolver: ReturnType<typeof vi.fn>;
  };
  readonly set: SetFn;
  readonly get: GetFn;
};

type HarnessParams = Record<string, never>;

const createHarness = ({}: HarnessParams): Harness => {
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    agentKindOverride: {},
    resolverState: {},
    resolverThreadOutcomes: {},
    refreshUnreadWorkspaces: vi.fn(async () => undefined),
    activateNextResolver: vi.fn(async () => undefined),
  };
  const set = ((update: unknown) => {
    if (typeof update === 'function') {
      Object.assign(state, update(state));
      return;
    }
    Object.assign(state, update);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get };
};

describe('completeResolvedAgent', () => {
  beforeEach(() => {
    h.invokeAgentList.mockClear();
    h.invokeAgentUpdateStatus.mockClear();
  });

  it('uses the analysis summary as the explanation posted on closure', async () => {
    const { state, set, get } = createHarness({});
    const summary = 'The existing guard already rejects an empty value.';

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: `<<comment-analysis threadId="PRRT_1" verdict="wontfix" summary="${summary}">>`,
      now: () => NOW,
    });

    const outcome = state.resolverThreadOutcomes[AGENT_ID]?.PRRT_1;
    expect(outcome).toEqual({ kind: 'analyzed', reply: summary });
    expect(buildResolutionReplyBody(outcome, null)).toBe(summary);
  });

  it('does not downgrade a resolved marker for the same thread', async () => {
    const { state, set, get } = createHarness({});

    await completeResolvedAgent({
      set,
      get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText:
        '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">> <<comment-wontfix threadId="PRRT_1" reason="not needed">> <<comment-analysis threadId="PRRT_1" verdict="wontfix" summary="no change needed">>',
      now: () => NOW,
    });

    expect(state.resolverState[AGENT_ID]).toBe('committed');
    expect(state.resolverThreadOutcomes[AGENT_ID]?.PRRT_1).toEqual({
      kind: 'resolved',
      commitSha: 'abcdef1234567890',
    });
  });
});
