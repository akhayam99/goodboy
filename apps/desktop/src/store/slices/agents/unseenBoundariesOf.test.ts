// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type Agent, type AgentId, type IsoDateTime } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { unseenBoundariesOf } from './unseenBoundariesOf';

const SCOUT = brandId<AgentId>({ value: 'agent-scout' });
const FIXER = brandId<AgentId>({ value: 'agent-fixer' });
const SEEN_AT = brandId<IsoDateTime>({ value: '2026-10-18T09:00:00.000Z' });
const FINISHED_AT = brandId<IsoDateTime>({ value: '2026-10-18T10:00:00.000Z' });

const unread = (): Agent =>
  anAgent({ id: SCOUT, status: 'completed', lastViewedAt: SEEN_AT, lastFinishedAt: FINISHED_AT });

const read = (): Agent =>
  anAgent({
    id: SCOUT,
    status: 'completed',
    lastViewedAt: FINISHED_AT,
    lastFinishedAt: FINISHED_AT,
  });

describe('unseenBoundariesOf', () => {
  it('remembers when the reader last looked at an agent that has a reply to read', () => {
    expect(
      unseenBoundariesOf({ boundaries: {}, agent: unread(), leftAgentId: null, agentId: SCOUT }),
    ).toEqual({ [SCOUT]: SEEN_AT });
  });

  it('keeps the boundary when the same agent is selected again after it was stamped', () => {
    const boundaries = { [SCOUT]: SEEN_AT };

    expect(
      unseenBoundariesOf({ boundaries, agent: read(), leftAgentId: SCOUT, agentId: SCOUT }),
    ).toBe(boundaries);
  });

  it('drops the boundary of the agent the reader leaves, and of one with nothing to read', () => {
    expect(
      unseenBoundariesOf({
        boundaries: { [SCOUT]: SEEN_AT },
        agent: undefined,
        leftAgentId: SCOUT,
        agentId: FIXER,
      }),
    ).toEqual({});
    expect(
      unseenBoundariesOf({
        boundaries: { [SCOUT]: SEEN_AT },
        agent: read(),
        leftAgentId: null,
        agentId: SCOUT,
      }),
    ).toEqual({});
  });

  it('marks nothing for an agent never viewed, since every row is new', () => {
    const never = anAgent({ id: SCOUT, status: 'completed', lastFinishedAt: FINISHED_AT });

    expect(
      unseenBoundariesOf({ boundaries: {}, agent: never, leftAgentId: null, agentId: SCOUT }),
    ).toEqual({});
  });
});
