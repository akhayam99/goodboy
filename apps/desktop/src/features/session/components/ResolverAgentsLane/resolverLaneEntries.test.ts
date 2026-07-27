import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { ResolverLink, ResolverStatus } from '../../resolver-linkage';
import { resolverLaneEntries } from './resolverLaneEntries';

const SESSION_ID = 'session-1' as SessionId;

const link = (id: string, ordinal: number, status: ResolverStatus): ResolverLink => ({
  agent: {
    id: id as AgentId,
    sessionId: SESSION_ID,
    ordinal,
    name: id,
    status: 'completed',
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

  it('counts wontfix, stopped and done as completed', () => {
    const entries = resolverLaneEntries({
      links: [
        link('wontfix', 0, 'wontfix'),
        link('stopped', 1, 'stopped'),
        link('done', 2, 'done'),
        link('awaiting', 3, 'awaiting'),
        link('committed', 4, 'committed'),
      ],
    });

    expect(entries.completed.map(({ agent }) => agent.id)).toEqual(['done', 'stopped', 'wontfix']);
    expect(entries.active.map(({ agent }) => agent.id)).toEqual(['committed', 'awaiting']);
  });

  it('orders each side newest first', () => {
    const entries = resolverLaneEntries({
      links: [link('old', 0, 'pending'), link('new', 5, 'pending')],
    });

    expect(entries.active.map(({ agent }) => agent.id)).toEqual(['new', 'old']);
  });
});
