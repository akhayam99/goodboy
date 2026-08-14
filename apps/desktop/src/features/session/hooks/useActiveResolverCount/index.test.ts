import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { ResolverLink, ResolverStatus } from '../../resolver-linkage';

const { hooks } = vi.hoisted(() => ({
  hooks: { resolverLinks: [] as ReadonlyArray<ResolverLink> },
}));

vi.mock('../useResolverIndex', () => ({
  useResolverIndex: () => ({
    links: hooks.resolverLinks,
    byThreadId: new Map(),
    byCommentUrl: new Map(),
    byDiffAgentId: new Map(),
  }),
}));

import { useActiveResolverCount } from './index';

const SID = 'sess-1' as SessionId;

const makeLink = ({
  id,
  status,
  doneAt = null,
}: {
  readonly id: string;
  readonly status: ResolverStatus;
  readonly doneAt?: string | null;
}): ResolverLink => ({
  agent: {
    id: id as AgentId,
    sessionId: SID,
    ordinal: 0,
    name: 'resolve the comment',
    status: 'running',
    doneAt,
  } as Agent,
  status,
});

beforeEach(() => {
  hooks.resolverLinks = [];
});

describe('useActiveResolverCount', () => {
  it('counts resolvers that are queued, running or committed but not settled', () => {
    hooks.resolverLinks = [
      makeLink({ id: 'a', status: 'running' }),
      makeLink({ id: 'b', status: 'committed' }),
      makeLink({ id: 'c', status: 'resolved' }),
      makeLink({ id: 'd', status: 'stopped' }),
    ];
    const { result } = renderHook(() => useActiveResolverCount(SID));
    expect(result.current).toBe(2);
  });

  it('is zero once every resolver has settled', () => {
    hooks.resolverLinks = [makeLink({ id: 'a', status: 'resolved' })];
    const { result } = renderHook(() => useActiveResolverCount(SID));
    expect(result.current).toBe(0);
  });

  it('is zero with no resolvers at all', () => {
    const { result } = renderHook(() => useActiveResolverCount(SID));
    expect(result.current).toBe(0);
  });
});
