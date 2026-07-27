import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { listOwnedRepos } from '../repos';

const makeRunner = (result: { stdout: string; stderr: string; exitCode: number }): GhRunner => ({
  run: vi.fn().mockResolvedValue(result),
});

const repo = (nameWithOwner: string) => ({
  nameWithOwner,
  url: `https://github.com/${nameWithOwner}`,
  sshUrl: `git@github.com:${nameWithOwner}.git`,
  isPrivate: false,
});

describe('listOwnedRepos', () => {
  it('returns the repositories sorted by name', async () => {
    const runner = makeRunner({
      stdout: JSON.stringify([repo('acme/widgets'), repo('acme/anvils')]),
      stderr: '',
      exitCode: 0,
    });

    const result = await listOwnedRepos(runner);

    expect(result).toEqual({ kind: 'ok', repos: [repo('acme/anvils'), repo('acme/widgets')] });
    expect(runner.run).toHaveBeenCalledWith(
      ['repo', 'list', '--limit', '100', '--json', 'nameWithOwner,url,sshUrl,isPrivate'],
      {},
    );
  });

  it('tells an empty account apart from a broken one', async () => {
    const runner = makeRunner({ stdout: '[]', stderr: '', exitCode: 0 });

    expect(await listOwnedRepos(runner)).toEqual({ kind: 'ok', repos: [] });
  });

  it('reports that gh is not signed in', async () => {
    const runner = makeRunner({
      stdout: '',
      stderr: 'To get started with GitHub CLI, please run: gh auth login',
      exitCode: 1,
    });

    expect(await listOwnedRepos(runner)).toEqual({ kind: 'unauthenticated' });
  });

  it('reports any other gh failure with what gh printed', async () => {
    const runner = makeRunner({ stdout: '', stderr: 'HTTP 502', exitCode: 1 });

    expect(await listOwnedRepos(runner)).toEqual({ kind: 'failed', message: 'HTTP 502' });
  });
});
