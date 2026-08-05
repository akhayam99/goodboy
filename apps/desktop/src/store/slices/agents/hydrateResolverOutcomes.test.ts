import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, Message, MessageId, SessionId } from '@goodboy/types';
import { resolverMissingVerdicts } from '../../../features/session/resolverMissingVerdicts';
import { resolverThreadSettlements } from '../../../features/session/resolverThreadSettlements';
import type { ResolverThreadOutcome } from '../../types';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  invokeAgentList: vi.fn(async () => [] as ReadonlyArray<Agent>),
  invokeAgentUpdateStatus: vi.fn(async () => undefined),
  listMessagesForAgent: vi.fn(async () => [] as ReadonlyArray<Message>),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.invokeAgentList,
  invokeAgentUpdateStatus: h.invokeAgentUpdateStatus,
}));

vi.mock('@goodboy/db', () => ({
  listMessagesForAgent: h.listMessagesForAgent,
}));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

import { completeResolvedAgent } from '../turn/completeResolvedAgent';
import { hydrateResolverOutcomes } from './hydrateResolverOutcomes';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const NOW = '2026-08-05T00:00:00.000Z' as IsoDateTime;

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'resolver',
  kind: 'resolver',
  status: 'completed',
  sourceThreadIds: ['PRRT_1', 'PRRT_2'],
};

const ASSISTANT_TEXT =
  '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">> <<comment-wontfix threadId="PRRT_2" reason="intentional">>';

const assistantMessage: Message = {
  id: 'message-1' as MessageId,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  role: 'assistant',
  content: ASSISTANT_TEXT,
  createdAt: NOW,
};

type State = {
  sessionPhaseRuns: Record<SessionId, ReadonlyArray<Agent>>;
  agentKindOverride: Record<AgentId, never>;
  resolverState: Record<AgentId, string>;
  resolverThreadOutcomes: Record<AgentId, Readonly<Record<string, ResolverThreadOutcome>>>;
  refreshUnreadWorkspaces: ReturnType<typeof vi.fn>;
  activateNextResolver: ReturnType<typeof vi.fn>;
};

const createHarness = (): { state: State; set: SetFn; get: GetFn } => {
  const state: State = {
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

const missingVerdictsFor = (state: State) =>
  resolverMissingVerdicts({
    settlements: resolverThreadSettlements({
      threadIds: ['PRRT_1', 'PRRT_2'],
      outcomes: state.resolverThreadOutcomes[AGENT_ID] ?? {},
      pendingResolutions: [],
      closedThreadIds: new Set<string>(),
    }),
    status: 'done',
    isBusy: false,
  });

describe('hydrateResolverOutcomes', () => {
  beforeEach(() => {
    h.listMessagesForAgent.mockReset();
    h.listMessagesForAgent.mockResolvedValue([assistantMessage]);
  });

  it('brings back the verdicts a restart dropped from memory', async () => {
    const live = createHarness();
    await completeResolvedAgent({
      set: live.set,
      get: live.get,
      sessionId: SESSION_ID,
      resolvedAgentId: AGENT_ID,
      assistantText: ASSISTANT_TEXT,
      now: () => NOW,
    });
    const beforeRestart = live.state.resolverThreadOutcomes[AGENT_ID];
    expect(beforeRestart).toEqual({
      PRRT_1: { kind: 'resolved', commitSha: 'abcdef1234567890' },
      PRRT_2: { kind: 'wontfix', reason: 'intentional' },
    });

    const rebooted = createHarness();
    expect(rebooted.state.resolverThreadOutcomes[AGENT_ID]).toBeUndefined();

    await hydrateResolverOutcomes(rebooted.set, rebooted.get)(SESSION_ID);

    expect(rebooted.state.resolverThreadOutcomes[AGENT_ID]).toEqual(beforeRestart);
  });

  it('stops the silence notice from accusing a resolver that did report', async () => {
    const rebooted = createHarness();
    expect(missingVerdictsFor(rebooted.state)?.threadIds).toEqual(['PRRT_1', 'PRRT_2']);

    await hydrateResolverOutcomes(rebooted.set, rebooted.get)(SESSION_ID);

    expect(missingVerdictsFor(rebooted.state)).toBeNull();
  });

  it('names only the thread left without a verdict', async () => {
    h.listMessagesForAgent.mockResolvedValue([
      {
        ...assistantMessage,
        content: '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">>',
      },
    ]);
    const rebooted = createHarness();

    await hydrateResolverOutcomes(rebooted.set, rebooted.get)(SESSION_ID);

    expect(missingVerdictsFor(rebooted.state)?.threadIds).toEqual(['PRRT_2']);
  });

  it('keeps the outcomes already in memory over the rebuilt ones', async () => {
    const rebooted = createHarness();
    rebooted.state.resolverThreadOutcomes = {
      [AGENT_ID]: { PRRT_1: { kind: 'analyzed', reply: 'newer' } },
    };

    await hydrateResolverOutcomes(rebooted.set, rebooted.get)(SESSION_ID);

    expect(rebooted.state.resolverThreadOutcomes[AGENT_ID]).toEqual({
      PRRT_1: { kind: 'analyzed', reply: 'newer' },
    });
    expect(h.listMessagesForAgent).not.toHaveBeenCalled();
  });
});
