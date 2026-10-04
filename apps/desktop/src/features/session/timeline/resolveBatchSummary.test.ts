import { describe, expect, it } from 'vitest';
import type { ResolveAttemptLike } from './resolveActivity';
import {
  RELATED_WINDOW_MS,
  resolveBatchByAgentId,
  resolveBatchTag,
  resolveBatchTitle,
} from './resolveBatchSummary';

const MINUTE = 60_000;

const attempt = (overrides: Partial<ResolveAttemptLike> & { readonly agentId: string }) => ({
  batchId: null,
  launchId: null,
  retryOfLaunchId: null,
  provider: 'anthropic',
  mountTarget: { mountId: 'payments-api' },
  prNumber: 318,
  threadIds: [],
  phase: 'finished' as const,
  createdAt: 0,
  ...overrides,
});

const keysOf = ({ attempts }: { readonly attempts: ReadonlyArray<ResolveAttemptLike> }) =>
  new Map(
    [...resolveBatchByAgentId({ attempts })].map(
      ([agentId, ref]) => [agentId, ref.batchId] as const,
    ),
  );

describe('resolveBatchByAgentId', () => {
  it('groups agents that share a launch id and no batch id', () => {
    const keys = keysOf({
      attempts: [
        attempt({ agentId: 'a', launchId: 'launch-1', createdAt: 0 }),
        attempt({ agentId: 'b', launchId: 'launch-1', createdAt: 30 * MINUTE }),
        attempt({ agentId: 'c', launchId: 'launch-2', createdAt: 0 }),
      ],
    });
    expect(keys.get('a')).toBe(keys.get('b'));
    expect(keys.get('c')).not.toBe(keys.get('a'));
  });

  it('keeps a retry in the group of its origin launch and labels it', () => {
    const refs = resolveBatchByAgentId({
      attempts: [
        attempt({ agentId: 'a', launchId: 'launch-1' }),
        attempt({ agentId: 'a2', launchId: 'launch-9', retryOfLaunchId: 'launch-1', createdAt: 5 }),
      ],
    });
    expect(refs.get('a2')?.batchId).toBe(refs.get('a')?.batchId);
    expect(refs.get('a2')?.isRetry).toBe(true);
    expect(refs.get('a')?.isRetry).toBe(false);
  });

  it('keeps the batch id of attempts written before launch ids existed', () => {
    const refs = resolveBatchByAgentId({
      attempts: [
        attempt({ agentId: 'a', batchId: 'batch-1' }),
        attempt({ agentId: 'b', batchId: 'batch-1' }),
        attempt({ agentId: 'retry', launchId: 'launch-9', retryOfLaunchId: 'batch-1' }),
      ],
    });
    expect(refs.get('a')?.batchId).toBe('batch-1');
    expect(refs.get('retry')?.batchId).toBe('batch-1');
  });

  it('relates rows with no ids by session, repo, provider and PR inside the window', () => {
    const refs = resolveBatchByAgentId({
      attempts: Array.from({ length: 7 }, (_, index) =>
        attempt({ agentId: `r${index}`, createdAt: index * MINUTE }),
      ),
    });
    expect(new Set([...refs.values()].map((ref) => ref.batchId)).size).toBe(1);
    expect([...refs.values()].every((ref) => ref.origin === 'related')).toBe(true);
  });

  it('anchors the window on the first member, so a long chain splits', () => {
    const refs = resolveBatchByAgentId({
      attempts: [
        attempt({ agentId: 'a', createdAt: 0 }),
        attempt({ agentId: 'b', createdAt: RELATED_WINDOW_MS - 1 }),
        attempt({ agentId: 'c', createdAt: RELATED_WINDOW_MS + 1 }),
        attempt({ agentId: 'd', createdAt: 2 * RELATED_WINDOW_MS }),
      ],
    });
    expect(refs.get('a')?.batchId).toBe(refs.get('b')?.batchId);
    expect(refs.get('c')?.batchId).not.toBe(refs.get('a')?.batchId);
    expect(refs.get('d')?.batchId).toBe(refs.get('c')?.batchId);
  });

  it('keeps apart rows that differ by provider, repo or PR, and rows without a PR', () => {
    const refs = resolveBatchByAgentId({
      attempts: [
        attempt({ agentId: 'base' }),
        attempt({ agentId: 'codex', provider: 'openai' }),
        attempt({ agentId: 'other-repo', mountTarget: { mountId: 'notify-relay' } }),
        attempt({ agentId: 'other-pr', prNumber: 319 }),
        attempt({ agentId: 'note-1', prNumber: null }),
        attempt({ agentId: 'note-2', prNumber: null }),
        attempt({ agentId: 'no-repo', mountTarget: null }),
      ],
    });
    const baseKey = refs.get('base')?.batchId;
    expect(refs.get('codex')?.batchId).not.toBe(baseKey);
    expect(refs.get('other-repo')?.batchId).not.toBe(baseKey);
    expect(refs.get('other-pr')?.batchId).not.toBe(baseKey);
    expect(refs.has('note-1')).toBe(false);
    expect(refs.has('note-2')).toBe(false);
    expect(refs.has('no-repo')).toBe(false);
  });
});

describe('resolve batch labels', () => {
  it('titles a burst with the PR and the agent count', () => {
    expect(resolveBatchTitle({ total: 7, prNumber: 318 })).toBe('Resolve #318 · 7 agents');
    expect(resolveBatchTitle({ total: 1, prNumber: null })).toBe('Resolve · 1 agent');
  });

  it('tags related groups and counts retries', () => {
    expect(resolveBatchTag({ origin: 'related', retryCount: 0 })).toBe('related');
    expect(resolveBatchTag({ origin: 'launch', retryCount: 0 })).toBeNull();
    expect(resolveBatchTag({ origin: 'launch', retryCount: 1 })).toBe('1 retry');
    expect(resolveBatchTag({ origin: 'launch', retryCount: 3 })).toBe('3 retries');
  });
});
