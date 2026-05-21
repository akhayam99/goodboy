import { describe, expect, it, vi } from 'vitest';
import type { IdeaBacklogId } from '@goodboy/types';
import { BrainDumpParseError, BrainDumpSpawnError } from './rephraser';
import { Clusterizer, type ClusterIdeaInput } from './clusterizer';

function makeInvoke(stdout: string, exitCode = 0, stderr = '') {
  return vi.fn(async (_cmd: string, _args?: unknown) => ({
    stdout,
    stderr,
    exitCode,
  }));
}

function anthropicResponse(payload: unknown): string {
  return JSON.stringify({ result: JSON.stringify(payload) });
}

const IDEAS: ReadonlyArray<ClusterIdeaInput> = [
  { id: 'a' as IdeaBacklogId, title: 'fix login flakiness', body: 'auth fails on retry' },
  { id: 'b' as IdeaBacklogId, title: 'add oauth2 pkce', body: 'replace legacy session' },
  { id: 'c' as IdeaBacklogId, title: 'profile slow query', body: 'orders endpoint hangs' },
  { id: 'd' as IdeaBacklogId, title: 'paginate orders list', body: 'frontend loads 5k rows' },
];

describe('Clusterizer', () => {
  it('returns empty clusters when input has <2 ideas (no CLI call)', async () => {
    const invokeFn = makeInvoke('should not be called');
    const c = new Clusterizer({ providerId: 'anthropic', invokeFn });
    const out = await c.clusterize({ ideas: [IDEAS[0]!] });
    expect(out.clusters).toEqual([]);
    expect(invokeFn).not.toHaveBeenCalled();
  });

  it('parses clusters and drops items not in the input set', async () => {
    const invokeFn = makeInvoke(
      anthropicResponse({
        clusters: [
          { name: 'auth', itemIds: ['a', 'b', 'ghost'] },
          { name: 'orders', itemIds: ['c', 'd'] },
        ],
      }),
    );
    const c = new Clusterizer({ providerId: 'anthropic', invokeFn });
    const out = await c.clusterize({ ideas: IDEAS });
    expect(out.clusters).toHaveLength(2);
    expect(out.clusters[0]!.name).toBe('auth');
    expect(out.clusters[0]!.itemIds).toEqual(['a', 'b']);
    expect(out.clusters[1]!.itemIds).toEqual(['c', 'd']);
  });

  it('prevents the same id appearing in two clusters (first cluster wins)', async () => {
    const invokeFn = makeInvoke(
      anthropicResponse({
        clusters: [
          { name: 'first', itemIds: ['a', 'b'] },
          { name: 'second', itemIds: ['a', 'c'] },
        ],
      }),
    );
    const c = new Clusterizer({ providerId: 'anthropic', invokeFn });
    const out = await c.clusterize({ ideas: IDEAS });
    expect(out.clusters[0]!.itemIds).toEqual(['a', 'b']);
    expect(out.clusters[1]!.itemIds).toEqual(['c']);
  });

  it('throws BrainDumpSpawnError on non-zero exit code', async () => {
    const invokeFn = makeInvoke('', 1, 'boom');
    const c = new Clusterizer({ providerId: 'anthropic', invokeFn });
    await expect(c.clusterize({ ideas: IDEAS })).rejects.toBeInstanceOf(BrainDumpSpawnError);
  });

  it('throws BrainDumpParseError when clusters field is missing', async () => {
    const invokeFn = makeInvoke(anthropicResponse({}));
    const c = new Clusterizer({ providerId: 'anthropic', invokeFn });
    await expect(c.clusterize({ ideas: IDEAS })).rejects.toBeInstanceOf(BrainDumpParseError);
  });
});
