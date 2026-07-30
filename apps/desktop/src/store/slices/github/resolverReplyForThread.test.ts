import type { AgentId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import type { ResolverThreadOutcome } from '../../types';
import { resolverReplyForThread } from './resolverReplyForThread';

const agent = (id: string): AgentId => id as AgentId;

const outcomes: Readonly<Record<AgentId, Readonly<Record<string, ResolverThreadOutcome>>>> = {
  [agent('a1')]: {
    PRRT_1: { kind: 'resolved', commitSha: 'abc1234', reply: 'answer for one' },
    PRRT_2: { kind: 'wontfix', reason: 'out of scope' },
  },
  [agent('a2')]: {
    PRRT_3: { kind: 'analyzed', reply: 'answer for three' },
  },
};

describe('resolverReplyForThread', () => {
  it('finds the reply of the thread whatever agent produced it', () => {
    expect(resolverReplyForThread(outcomes, 'PRRT_1')).toBe('answer for one');
    expect(resolverReplyForThread(outcomes, 'PRRT_3')).toBe('answer for three');
  });

  it('returns null for a thread without a reply', () => {
    expect(resolverReplyForThread(outcomes, 'PRRT_2')).toBeNull();
  });

  it('returns null for an unknown thread', () => {
    expect(resolverReplyForThread(outcomes, 'PRRT_9')).toBeNull();
  });
});
