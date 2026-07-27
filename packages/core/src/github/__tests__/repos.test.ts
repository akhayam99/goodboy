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

    const repos = await listOwnedRepos(runner);

    expect(repos.map((r) => r.nameWithOwner)).toEqual(['acme/anvils', 'acme/widgets']);
    expect(runner.run).toHaveBeenCalledWith(
      ['repo', 'list', '--limit', '100', '--json', 'nameWithOwner,url,sshUrl,isPrivate'],
      {},
    );
  });

  it('returns nothing when gh cannot answer', async () => {
    const runner = makeRunner({ stdout: '', stderr: 'not logged in', exitCode: 1 });

    expect(await listOwnedRepos(runner)).toEqual([]);
  });
});
