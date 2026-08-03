import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { ResolverLink, ResolverStatus } from '../../resolver-linkage';
import {
  activeResolverIds,
  hasOtherActiveResolver,
  isResolverQueueStalled,
  resolverLaneEntries,
} from './resolverLaneEntries';

const SESSION_ID = 'session-1' as SessionId;

const link = (
  id: string,
  ordinal: number,
  status: ResolverStatus,
  doneAt?: string,
  agentStatus: Agent['status'] = 'completed',
): ResolverLink => ({
  agent: {
    id: id as AgentId,
    sessionId: SESSION_ID,
    ordinal,
    name: id,
    status: agentStatus,
    ...(doneAt != null && { doneAt }),
  } as Agent,
  status,
});

describe('resolverLaneEntries', () => {
  it('splits finished resolvers out of the active side', () => {
    const entries = resolverLaneEntries({
      links: [link('running', 0, 'running'), link('resolved', 1, 'resolved')],
    });

    expect(entries.active.map(({ agent }) => agent.id)).toEqual(['running']);
    expect(entries.completed.map(({ agent }) => agent.id)).toEqual(['resolved']);
  });

  it('keeps a resolver active until its thread is settled or the operator says so', () => {
    const entries = resolverLaneEntries({
      links: [
        link('wontfix', 0, 'wontfix'),
        link('stopped', 1, 'stopped'),
        link('done', 2, 'done'),
        link('awaiting', 3, 'awaiting'),
        link('committed', 4, 'committed'),
      ],
    });

    expect(entries.completed.map(({ agent }) => agent.id)).toEqual(['stopped']);
    expect(entries.active.map(({ agent }) => agent.id)).toEqual([
      'committed',
      'awaiting',
      'done',
      'wontfix',
    ]);
  });

  it('takes the operator marking one done as the final word', () => {
    const entries = resolverLaneEntries({
      links: [link('explained', 0, 'wontfix', '2026-08-03T10:00:00.000Z')],
    });

    expect(entries.completed.map(({ agent }) => agent.id)).toEqual(['explained']);
    expect(entries.active).toEqual([]);
  });

  it('orders each side newest first', () => {
    const entries = resolverLaneEntries({
      links: [link('old', 0, 'pending'), link('new', 5, 'pending')],
    });

    expect(entries.active.map(({ agent }) => agent.id)).toEqual(['new', 'old']);
  });

  it('tells one resolver whether anyone else is still working', () => {
    const activeIds = activeResolverIds({
      links: [link('a', 0, 'committed'), link('b', 1, 'resolved')],
    });

    expect(hasOtherActiveResolver({ activeIds, agentId: 'a' as AgentId })).toBe(false);
    expect(hasOtherActiveResolver({ activeIds, agentId: 'b' as AgentId })).toBe(true);
  });

  it('calls the queue stalled only when something waits and nothing runs', () => {
    const queued = link('queued', 0, 'pending', undefined, 'pending');
    const running = link('running', 1, 'running', undefined, 'running');

    expect(isResolverQueueStalled({ links: [queued] })).toBe(true);
    expect(isResolverQueueStalled({ links: [queued, running] })).toBe(false);
    expect(isResolverQueueStalled({ links: [running] })).toBe(false);
  });
});
