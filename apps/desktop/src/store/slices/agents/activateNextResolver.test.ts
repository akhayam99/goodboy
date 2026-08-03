import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';
import { activateNextResolver } from './activateNextResolver';

const SID = 'sess-1' as SessionId;
const FIRST = 'resolver-1' as AgentId;
const SECOND = 'resolver-2' as AgentId;

const resolver = (over: Partial<Agent> & { id: AgentId }): Agent => ({
  sessionId: SID,
  ordinal: 0,
  name: 'resolve: reviewer on a.ts:1',
  status: 'pending',
  kind: 'resolver',
  ...over,
});

const makeStore = ({
  agents,
  pendingResolverKickoff,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly pendingResolverKickoff: Record<string, string>;
}) => {
  const sendTurn = vi.fn(async () => undefined);
  const selectAgent = vi.fn(async () => undefined);
  const state: Record<string, unknown> = {
    sessionPhaseRuns: { [SID]: agents },
    agentKindOverride: {},
    pendingResolverKickoff,
    sendTurn,
    selectAgent,
  };
  const get = (() => state) as unknown as GetFn;
  const set = ((u: unknown) => {
    const patch =
      typeof u === 'function'
        ? (u as (s: Record<string, unknown>) => Record<string, unknown>)(state)
        : (u as Record<string, unknown>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  return { state, get, set, sendTurn, selectAgent };
};

afterEach(() => vi.clearAllMocks());

describe('activateNextResolver', () => {
  it('starts the lowest ordinal queued resolver and consumes its kickoff', async () => {
    const { state, get, set, sendTurn, selectAgent } = makeStore({
      agents: [resolver({ id: SECOND, ordinal: 2 }), resolver({ id: FIRST, ordinal: 1 })],
      pendingResolverKickoff: { [FIRST]: 'fix comment one', [SECOND]: 'fix comment two' },
    });

    await activateNextResolver(set, get)(SID);

    expect(selectAgent).toHaveBeenCalledWith(SID, FIRST);
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: FIRST, content: 'fix comment one' }),
    );
    expect((state.pendingResolverKickoff as Record<string, string>)[FIRST]).toBeUndefined();
  });

  it('keeps one resolver at a time while another is running', async () => {
    const { get, set, sendTurn } = makeStore({
      agents: [
        resolver({ id: FIRST, ordinal: 1, status: 'running' }),
        resolver({ id: SECOND, ordinal: 2 }),
      ],
      pendingResolverKickoff: { [SECOND]: 'fix comment two' },
    });

    await activateNextResolver(set, get)(SID);

    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('skips a queued resolver that has no kickoff waiting', async () => {
    const { get, set, sendTurn } = makeStore({
      agents: [resolver({ id: FIRST, ordinal: 1 })],
      pendingResolverKickoff: {},
    });

    await activateNextResolver(set, get)(SID);

    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('leaves a queued resolver the operator marked done out of the rotation', async () => {
    const { get, set, sendTurn } = makeStore({
      agents: [
        resolver({ id: FIRST, ordinal: 1, doneAt: '2026-08-03T10:00:00.000Z' as IsoDateTime }),
        resolver({ id: SECOND, ordinal: 2 }),
      ],
      pendingResolverKickoff: { [FIRST]: 'fix comment one', [SECOND]: 'fix comment two' },
    });

    await activateNextResolver(set, get)(SID);

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: SECOND, content: 'fix comment two' }),
    );
  });

  it('ignores a force closed resolver when picking the next one', async () => {
    const { get, set, sendTurn } = makeStore({
      agents: [
        resolver({ id: FIRST, ordinal: 1, status: 'skipped' }),
        resolver({ id: SECOND, ordinal: 2 }),
      ],
      pendingResolverKickoff: { [SECOND]: 'fix comment two' },
    });

    await activateNextResolver(set, get)(SID);

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: SECOND, content: 'fix comment two' }),
    );
  });
});
