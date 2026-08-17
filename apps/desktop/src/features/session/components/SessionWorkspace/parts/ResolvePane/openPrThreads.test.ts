import { describe, expect, it } from 'vitest';
import type { Agent, PrComment } from '@goodboy/types';
import { buildResolverIndex } from '../../../../resolver-linkage';
import { openPrThreads } from './openPrThreads';

const buildComment = (overrides: Partial<PrComment>): PrComment =>
  ({
    id: 'c1',
    author: 'ada',
    authorAvatarUrl: null,
    body: 'take a look at this',
    createdAt: '2026-08-01T00:00:00Z',
    url: 'https://github.com/x/y/pull/1#discussion_r1',
    source: 'review',
    threadId: 'PRRT_1',
    ...overrides,
  }) as PrComment;

const buildIndex = (
  overrides: {
    readonly agents?: ReadonlyArray<Agent>;
    readonly status?: (agent: Agent) => 'pending' | 'running' | 'failed' | 'done';
  } = {},
) =>
  buildResolverIndex(overrides.agents ?? [], {
    resolvedThreadIds: new Set(),
    pendingThreadIds: new Set(),
    statusOf: overrides.status ?? (() => 'pending'),
  });

describe('openPrThreads', () => {
  it('lists open review head comments without a resolver', () => {
    const result = openPrThreads({
      comments: [buildComment({}), buildComment({ id: 'c2', threadId: 'PRRT_2' })],
      resolverIndex: buildIndex(),
    });
    expect(result.map((comment) => comment.threadId)).toEqual(['PRRT_1', 'PRRT_2']);
  });

  it('drops resolved threads', () => {
    const result = openPrThreads({
      comments: [buildComment({ resolved: true })],
      resolverIndex: buildIndex(),
    });
    expect(result).toEqual([]);
  });

  it('drops outdated threads', () => {
    const result = openPrThreads({
      comments: [buildComment({ outdated: true })],
      resolverIndex: buildIndex(),
    });
    expect(result).toEqual([]);
  });

  it('drops threads already claimed by a live resolver', () => {
    const agent = {
      id: 'agent-1',
      sourceThreadId: 'PRRT_1',
    } as unknown as Agent;
    const result = openPrThreads({
      comments: [buildComment({})],
      resolverIndex: buildIndex({ agents: [agent], status: () => 'running' }),
    });
    expect(result).toEqual([]);
  });

  it('lets a comment reappear when its resolver failed', () => {
    const agent = {
      id: 'agent-1',
      sourceThreadId: 'PRRT_1',
    } as unknown as Agent;
    const result = openPrThreads({
      comments: [buildComment({})],
      resolverIndex: buildIndex({ agents: [agent], status: () => 'failed' }),
    });
    expect(result.map((comment) => comment.threadId)).toEqual(['PRRT_1']);
  });

  it('deduplicates threads by taking the first comment per thread', () => {
    const result = openPrThreads({
      comments: [
        buildComment({ id: 'head' }),
        buildComment({ id: 'reply', inReplyToId: 'head' }),
        buildComment({ id: 'duplicate' }),
      ],
      resolverIndex: buildIndex(),
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('head');
  });

  it('ignores issue-scope comments and comments without a threadId', () => {
    const result = openPrThreads({
      comments: [
        buildComment({ source: 'issue', threadId: 'PRRT_9' }),
        buildComment({ id: 'no-thread', threadId: undefined }),
      ],
      resolverIndex: buildIndex(),
    });
    expect(result).toEqual([]);
  });
});
