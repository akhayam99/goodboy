import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import {
  buildResolverIndex,
  resolverForComment,
  resolverStatus,
  type ResolverStatus,
} from '../../resolver-linkage';

const SESSION = 'sess_1' as SessionId;

const makeAgent = (
  id: string,
  extra: {
    sourceThreadId?: string;
    sourceThreadIds?: ReadonlyArray<string>;
    sourceCommentUrl?: string;
    status?: Agent['status'];
  } = {},
): Agent => ({
  id: id as AgentId,
  sessionId: SESSION,
  ordinal: 0,
  name: 'resolver',
  status: extra.status ?? 'completed',
  ...(extra.sourceThreadId != null && { sourceThreadId: extra.sourceThreadId }),
  ...(extra.sourceThreadIds != null && { sourceThreadIds: extra.sourceThreadIds }),
  ...(extra.sourceCommentUrl != null && { sourceCommentUrl: extra.sourceCommentUrl }),
});

const statusFromSets =
  (resolvedThreadIds: ReadonlySet<string>, pendingThreadIds: ReadonlySet<string>) =>
  (agent: Agent): ResolverStatus =>
    resolverStatus(agent, resolvedThreadIds, pendingThreadIds, undefined);

describe('buildResolverIndex', () => {
  it('keys thread resolvers by threadId', () => {
    const a = makeAgent('a1', { sourceThreadId: 't1' });
    const idx = buildResolverIndex([a], {
      resolvedThreadIds: new Set(),
      pendingThreadIds: new Set(),
      statusOf: statusFromSets(new Set(), new Set()),
    });
    expect(idx.byThreadId.get('t1')?.agent.id).toBe('a1');
    expect(idx.byCommentUrl.size).toBe(0);
    expect(idx.byDiffAgentId.size).toBe(0);
  });

  it('maps every combined thread id to the same resolver', () => {
    const agent = makeAgent('combined', { sourceThreadIds: ['t1', 't2'] });
    const index = buildResolverIndex([agent], {
      resolvedThreadIds: new Set(),
      pendingThreadIds: new Set(),
      statusOf: statusFromSets(new Set(), new Set()),
    });
    expect(index.byThreadId.get('t1')?.agent.id).toBe('combined');
    expect(index.byThreadId.get('t2')?.agent.id).toBe('combined');
  });

  it('falls back to commentUrl when no threadId', () => {
    const a = makeAgent('a2', { sourceCommentUrl: 'https://example/c/2' });
    const idx = buildResolverIndex([a], {
      resolvedThreadIds: new Set(),
      pendingThreadIds: new Set(),
      statusOf: statusFromSets(new Set(), new Set()),
    });
    expect(idx.byCommentUrl.get('https://example/c/2')?.agent.id).toBe('a2');
    expect(idx.byThreadId.size).toBe(0);
    expect(idx.byDiffAgentId.size).toBe(0);
  });

  it('routes diff-note resolvers (no thread, no url) to byDiffAgentId keyed by agent id', () => {
    const a = makeAgent('a3');
    const idx = buildResolverIndex([a], {
      resolvedThreadIds: new Set(),
      pendingThreadIds: new Set(),
      statusOf: statusFromSets(new Set(), new Set()),
    });
    expect(idx.byDiffAgentId.get('a3' as AgentId)?.agent.id).toBe('a3');
    expect(idx.byThreadId.size).toBe(0);
    expect(idx.byCommentUrl.size).toBe(0);
  });

  it('maps status none/in-progress/queued/resolved through resolverStatus', () => {
    const none = makeAgent('n', { sourceThreadId: 'tn' });
    const running = makeAgent('r', { sourceThreadId: 'tr', status: 'running' });
    const queued = makeAgent('q', { sourceThreadId: 'tq' });
    const resolved = makeAgent('d', { sourceThreadId: 'td' });
    const resolvedThreadIds = new Set(['td']);
    const pendingThreadIds = new Set(['tq']);
    const idx = buildResolverIndex([none, running, queued, resolved], {
      resolvedThreadIds,
      pendingThreadIds,
      statusOf: statusFromSets(resolvedThreadIds, pendingThreadIds),
    });
    expect(idx.byThreadId.get('tn')?.status).toBe('done');
    expect(idx.byThreadId.get('tr')?.status).toBe('running');
    expect(idx.byThreadId.get('tq')?.status).toBe('committed');
    expect(idx.byThreadId.get('td')?.status).toBe('resolved');
  });

  it('keeps the first resolver per threadId for dedup detection', () => {
    const first = makeAgent('first', { sourceThreadId: 'dup' });
    const second = makeAgent('second', { sourceThreadId: 'dup' });
    const idx = buildResolverIndex([first, second], {
      resolvedThreadIds: new Set(),
      pendingThreadIds: new Set(),
      statusOf: statusFromSets(new Set(), new Set()),
    });
    expect(idx.byThreadId.get('dup')?.agent.id).toBe('first');
    expect(idx.byThreadId.size).toBe(1);
  });
});

describe('resolverForComment', () => {
  const a = makeAgent('a1', { sourceThreadId: 't1' });
  const b = makeAgent('b1', { sourceCommentUrl: 'https://example/c/1' });
  const idx = buildResolverIndex([a, b], {
    resolvedThreadIds: new Set(),
    pendingThreadIds: new Set(),
    statusOf: statusFromSets(new Set(), new Set()),
  });

  it('resolves by threadId first', () => {
    expect(resolverForComment(idx, { threadId: 't1' })?.agent.id).toBe('a1');
  });

  it('falls back to url when threadId misses', () => {
    expect(resolverForComment(idx, { url: 'https://example/c/1' })?.agent.id).toBe('b1');
  });

  it('prefers threadId over url when both given', () => {
    expect(resolverForComment(idx, { threadId: 't1', url: 'https://example/c/1' })?.agent.id).toBe(
      'a1',
    );
  });

  it('returns undefined for an unknown comment', () => {
    expect(resolverForComment(idx, { threadId: 'nope' })).toBeUndefined();
  });
});
