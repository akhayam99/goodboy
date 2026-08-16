import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { createGithubRepo, listOwnedRepos, validateGithubRepoName } from '../repos';

const reposSource = readFileSync(fileURLToPath(new URL('../repos.ts', import.meta.url)), 'utf8');

const makeRunner = (result: { stdout: string; stderr: string; exitCode: number }): GhRunner => ({
  run: vi.fn().mockResolvedValue(result),
});

const repo = (nameWithOwner: string, isPrivate = false) => ({
  nameWithOwner,
  url: `https://github.com/${nameWithOwner}`,
  sshUrl: `git@github.com:${nameWithOwner}.git`,
  isPrivate,
});

describe('the repos module surface', () => {
  it('carries no gh subcommand beyond repo create, repo view and repo list', () => {
    const subcommands = Array.from(reposSource.matchAll(/'repo',\s*'([a-z-]+)'/g)).map(
      (match) => match[1],
    );

    expect(subcommands.length).toBeGreaterThan(0);
    for (const subcommand of subcommands) {
      expect(['create', 'view', 'list']).toContain(subcommand);
    }
  });

  it('never reaches for a destructive gh call', () => {
    expect(reposSource).not.toContain('delete');
    expect(reposSource).not.toContain("'api'");
    expect(reposSource).not.toContain('-X');
  });

  it('keeps the visibility flag inside the closed record', () => {
    const flags = Array.from(reposSource.matchAll(/'--(public|private)'/g)).map(
      (match) => match[0],
    );

    expect(flags).toEqual(["'--public'", "'--private'"]);
  });
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
        stdout: JSON.stringify(repo('acme/widgets', true)),
        stderr: '',
        exitCode: 0,
      });

    const result = await createGithubRepo({
      runner: { run },
      name: 'widgets',
      owner: 'acme',
      visibility: 'private',
    });

    expect(result).toEqual({ kind: 'ok', repo: repo('acme/widgets', true) });
    expect(run).toHaveBeenNthCalledWith(1, ['repo', 'create', 'widgets', '--private'], {});
  });

  it('never lets a rejected name reach gh argv', async () => {
    const run = vi.fn();

    const result = await createGithubRepo({
      runner: { run },
      name: '--public',
      owner: 'acme',
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
      await createGithubRepo({
        runner: signedOut,
        name: 'widgets',
        owner: 'acme',
        visibility: 'public',
      }),
    ).toEqual({ kind: 'unauthenticated' });
    expect(
      await createGithubRepo({
        runner: taken,
        name: 'widgets',
        owner: 'acme',
        visibility: 'public',
      }),
    ).toEqual({ kind: 'failed', message: 'GraphQL: Name already exists on this account' });
  });

  it('never asks gh to view a bare name', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify(repo('acme/widgets')),
        stderr: '',
        exitCode: 0,
      });

    await createGithubRepo({
      runner: { run },
      name: 'widgets',
      owner: 'acme',
      visibility: 'public',
    });

    const viewArgs: ReadonlyArray<string> = run.mock.calls[1]?.[0] ?? [];
    expect(viewArgs[0]).toBe('repo');
    expect(viewArgs[1]).toBe('view');
    expect(viewArgs[2]).toBe('acme/widgets');
    expect(viewArgs[2]?.includes('/')).toBe(true);
  });

  it('pins the owner from the create output when the session does not carry one', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: 'Created repository acme/widgets on GitHub\nhttps://github.com/acme/widgets\n',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify(repo('acme/widgets')),
        stderr: '',
        exitCode: 0,
      });

    const result = await createGithubRepo({
      runner: { run },
      name: 'widgets',
      owner: null,
      visibility: 'public',
    });

    expect(result.kind).toBe('ok');
    expect(run.mock.calls[1]?.[0]?.[2]).toBe('acme/widgets');
  });

  it('refuses to guess an owner and discloses the repository it left behind', async () => {
    const run = vi.fn().mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await createGithubRepo({
      runner: { run },
      name: 'widgets',
      owner: null,
      visibility: 'public',
    });

    expect(result.kind).toBe('unverified');
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.kind === 'unverified' && result.message).toContain('was not removed');
  });

  it('reports a repository that came back under a different owner as a mismatch', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify(repo('someone-else/widgets')),
        stderr: '',
        exitCode: 0,
      });

    const result = await createGithubRepo({
      runner: { run },
      name: 'widgets',
      owner: 'acme',
      visibility: 'public',
    });

    expect(result.kind).toBe('mismatch');
    expect(result.kind === 'mismatch' && result.expected.nameWithOwner).toBe('acme/widgets');
    expect(result.kind === 'mismatch' && result.actual.nameWithOwner).toBe('someone-else/widgets');
  });

  it('reports a public repository created for a private request as a mismatch', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify(repo('acme/widgets', false)),
        stderr: '',
        exitCode: 0,
      });

    const result = await createGithubRepo({
      runner: { run },
      name: 'widgets',
      owner: 'acme',
      visibility: 'private',
    });

    expect(result.kind).toBe('mismatch');
    expect(result.kind === 'mismatch' && result.expected.isPrivate).toBe(true);
    expect(result.kind === 'mismatch' && result.actual.isPrivate).toBe(false);
  });

  it('discloses the repository it left behind when the read back fails', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'HTTP 502', exitCode: 1 });

    const result = await createGithubRepo({
      runner: { run },
      name: 'widgets',
      owner: 'acme',
      visibility: 'public',
    });

    expect(result.kind).toBe('unverified');
    expect(result.kind === 'unverified' && result.nameWithOwner).toBe('acme/widgets');
    expect(result.kind === 'unverified' && result.message).toContain('was not removed');
  });

  it('never deletes anything and never reaches past the gh allowlist', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: '', stderr: 'HTTP 502', exitCode: 1 });

    await createGithubRepo({
      runner: { run },
      name: 'widgets',
      owner: 'acme',
      visibility: 'public',
    });

    for (const call of run.mock.calls) {
      const args: ReadonlyArray<string> = call[0] ?? [];
      expect(args[0]).toBe('repo');
      expect(['create', 'view', 'list']).toContain(args[1]);
      expect(args).not.toContain('delete');
      expect(args).not.toContain('-X');
    }
  });
});
