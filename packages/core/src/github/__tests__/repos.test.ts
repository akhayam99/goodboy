import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { createGithubRepo, listOwnedRepos, validateGithubRepoName } from '../repos';

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

describe('validateGithubRepoName', () => {
  it('accepts a name made of the characters GitHub allows', () => {
    expect(validateGithubRepoName({ name: '  my-project_v2.1  ' })).toEqual({
      kind: 'ok',
      name: 'my-project_v2.1',
    });
  });

  it('rejects a leading dash rather than stripping it', () => {
    const result = validateGithubRepoName({ name: '--upstream=evil' });

    expect(result).toEqual({
      kind: 'invalid',
      reason: 'A repository name cannot start with a dash.',
    });
    expect(result).not.toHaveProperty('name');
  });

  it('rejects an empty name, a dot name, an over-long name and a stray character', () => {
    expect(validateGithubRepoName({ name: '   ' }).kind).toBe('invalid');
    expect(validateGithubRepoName({ name: '..' }).kind).toBe('invalid');
    expect(validateGithubRepoName({ name: 'a'.repeat(101) }).kind).toBe('invalid');
    expect(validateGithubRepoName({ name: 'my project' }).kind).toBe('invalid');
    expect(validateGithubRepoName({ name: 'rm -rf /' }).kind).toBe('invalid');
  });
});

describe('createGithubRepo', () => {
  it('creates the repository with the visibility flag and reads it back', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify(repo('acme/widgets')),
        stderr: '',
        exitCode: 0,
      });

    const result = await createGithubRepo({
      runner: { run },
      name: 'widgets',
      visibility: 'private',
    });

    expect(result).toEqual({ kind: 'ok', repo: repo('acme/widgets') });
    expect(run).toHaveBeenNthCalledWith(1, ['repo', 'create', 'widgets', '--private'], {});
  });

  it('never lets a rejected name reach gh argv', async () => {
    const run = vi.fn();

    const result = await createGithubRepo({
      runner: { run },
      name: '--public',
      visibility: 'public',
    });

    expect(result).toEqual({
      kind: 'invalid-name',
      reason: 'A repository name cannot start with a dash.',
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('tells a signed-out account apart from a failed creation', async () => {
    const signedOut = makeRunner({
      stdout: '',
      stderr: 'To get started with GitHub CLI, please run: gh auth login',
      exitCode: 1,
    });
    const taken = makeRunner({
      stdout: '',
      stderr: 'GraphQL: Name already exists on this account',
      exitCode: 1,
    });

    expect(
      await createGithubRepo({ runner: signedOut, name: 'widgets', visibility: 'public' }),
    ).toEqual({ kind: 'unauthenticated' });
    expect(
      await createGithubRepo({ runner: taken, name: 'widgets', visibility: 'public' }),
    ).toEqual({ kind: 'failed', message: 'GraphQL: Name already exists on this account' });
  });
});
