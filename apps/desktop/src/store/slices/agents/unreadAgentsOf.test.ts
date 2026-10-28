// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { unreadLabelOf } from '../../../features/session/unreadLabelOf';
import { unreadAgentsOf } from './unreadAgentsOf';

const at = (value: string) => brandId<IsoDateTime>({ value });

const agentOf = (id: string, finishedAt: string | null, summary = `Result of ${id}`) =>
  anAgent({
    id: brandId<AgentId>({ value: id }),
    name: `Step ${id}`,
    outputSummary: summary,
    ...(finishedAt === null ? {} : { lastFinishedAt: at(finishedAt) }),
  });

describe('unreadAgentsOf', () => {
  it('keeps agents that finished and were never viewed, newest first', () => {
    const unread = unreadAgentsOf({
      agents: [
        agentOf('old', '2026-10-18T09:00:00.000Z'),
        agentOf('new', '2026-10-18T11:00:00.000Z'),
        agentOf('running', null),
      ],
    });

    expect(unread.map((agent) => agent.id)).toEqual(['new', 'old']);
  });

  it('drops the agent being viewed and undefined input', () => {
    const agents = [agentOf('a', '2026-10-18T09:00:00.000Z')];

    expect(unreadAgentsOf({ agents, viewedAgentId: brandId<AgentId>({ value: 'a' }) })).toEqual([]);
    expect(unreadAgentsOf({ agents: undefined })).toEqual([]);
  });
});

describe('unreadLabelOf', () => {
  it('says nothing when nothing is unread', () => {
    expect(unreadLabelOf({ unread: [] })).toBeNull();
  });

  it('names the newest unread item', () => {
    const unread = unreadAgentsOf({
      agents: [agentOf('a', '2026-10-18T09:00:00.000Z', 'Step 1 result of the Harborline ledger.')],
    });

    expect(unreadLabelOf({ unread })).toBe('1 new: Step 1 result of the Harborline ledger');
  });

  it('counts the rest after the newest title', () => {
    const unread = unreadAgentsOf({
      agents: [
        agentOf('a', '2026-10-18T09:00:00.000Z', 'Built payments-api.'),
        agentOf('b', '2026-10-18T10:00:00.000Z', 'Fixed notify-relay.'),
        agentOf('c', '2026-10-18T11:00:00.000Z', 'Checked Northwind.'),
      ],
    });

    expect(unreadLabelOf({ unread })).toBe('3 new: Checked Northwind, and 2 more');
  });
});
