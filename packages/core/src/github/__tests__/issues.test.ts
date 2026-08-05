import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import {
  createIssueComment,
  listAssignedIssues,
  listIssueComments,
  updateIssueBody,
} from '../issues';

describe('listAssignedIssues', () => {
  it('lists open assigned issues and maps GitHub labels', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        {
          number: 42,
          title: 'Add issue dashboard',
          body: null,
          url: 'https://github.com/goodboy/goodboy/issues/42',
          state: 'OPEN',
          labels: [{ name: 'feature' }, { name: 'desktop' }],
          assignees: [{ login: 'octocat' }],
          updatedAt: '2026-07-22T10:00:00Z',
        },
      ]),
      stderr: '',
      exitCode: 0,
    });
    const runner: GhRunner = { run };

    const result = await listAssignedIssues(runner, 'goodboy/goodboy', {
      cwd: '/repos/goodboy',
      workspaceId: 'workspace-1',
    });

    expect(run).toHaveBeenCalledWith(
      [
        'issue',
        'list',
        '--repo',
        'goodboy/goodboy',
        '--assignee',
        '@me',
        '--state',
        'open',
        '--limit',
        '50',
        '--json',
        'number,title,body,url,state,labels,assignees,updatedAt',
      ],
      {
        cwd: '/repos/goodboy',
        workspaceId: 'workspace-1',
      },
    );
    expect(result).toEqual([
      {
        number: 42,
        title: 'Add issue dashboard',
        body: '',
        url: 'https://github.com/goodboy/goodboy/issues/42',
        state: 'OPEN',
        labels: ['feature', 'desktop'],
        updatedAt: '2026-07-22T10:00:00Z',
      },
    ]);
  });
});

describe('listIssueComments', () => {
  it('reads the issue thread and maps every comment to its author', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        {
          id: 7,
          user: { login: 'octocat', avatar_url: 'https://avatars/octocat' },
          body: 'Blocked on the migration.',
          created_at: '2026-07-23T10:00:00Z',
          html_url: 'https://github.com/goodboy/goodboy/issues/42#issuecomment-7',
        },
        {
          id: 8,
          user: null,
          body: null,
          created_at: '2026-07-23T11:00:00Z',
          html_url: 'https://github.com/goodboy/goodboy/issues/42#issuecomment-8',
        },
      ]),
      stderr: '',
      exitCode: 0,
    });
    const runner: GhRunner = { run };

    const comments = await listIssueComments({
      runner,
      repoSlug: 'goodboy/goodboy',
      issueNumber: 42,
      opts: { cwd: '/repos/goodboy', workspaceId: 'workspace-1' },
    });

    expect(run).toHaveBeenCalledWith(
      ['api', 'repos/goodboy/goodboy/issues/42/comments', '--paginate'],
      { cwd: '/repos/goodboy', workspaceId: 'workspace-1' },
    );
    expect(comments).toEqual([
      {
        id: '7',
        author: 'octocat',
        authorAvatarUrl: 'https://avatars/octocat',
        body: 'Blocked on the migration.',
        createdAt: '2026-07-23T10:00:00Z',
        url: 'https://github.com/goodboy/goodboy/issues/42#issuecomment-7',
      },
      {
        id: '8',
        author: 'unknown',
        authorAvatarUrl: null,
        body: '',
        createdAt: '2026-07-23T11:00:00Z',
        url: 'https://github.com/goodboy/goodboy/issues/42#issuecomment-8',
      },
    ]);
  });
});

describe('createIssueComment', () => {
  it('posts the comment to the issue thread and returns it', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        id: 9,
        user: { login: 'octocat', avatar_url: null },
        body: 'On it.',
        created_at: '2026-07-23T12:00:00Z',
        html_url: 'https://github.com/goodboy/goodboy/issues/42#issuecomment-9',
      }),
      stderr: '',
      exitCode: 0,
    });
    const runner: GhRunner = { run };

    const comment = await createIssueComment({
      runner,
      repoSlug: 'goodboy/goodboy',
      issueNumber: 42,
      body: 'On it.',
    });

    expect(run).toHaveBeenCalledWith(
      ['api', 'repos/goodboy/goodboy/issues/42/comments', '-X', 'POST', '-f', 'body=On it.'],
      {},
    );
    expect(comment.body).toBe('On it.');
    expect(comment.author).toBe('octocat');
  });

  it('raises the gh failure so the caller can keep the draft', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: 'HTTP 403: Resource not accessible by integration',
      exitCode: 1,
    });
    const runner: GhRunner = { run };

    await expect(
      createIssueComment({
        runner,
        repoSlug: 'goodboy/goodboy',
        issueNumber: 42,
        body: 'nope',
      }),
    ).rejects.toThrow(/exited with 1/);
  });
});

describe('updateIssueBody', () => {
  it('patches the issue body and returns the stored text', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ number: 42, body: 'Rewritten from Goodboy.' }),
      stderr: '',
      exitCode: 0,
    });
    const runner: GhRunner = { run };

    const body = await updateIssueBody({
      runner,
      repoSlug: 'goodboy/goodboy',
      issueNumber: 42,
      body: 'Rewritten from Goodboy.',
      opts: { cwd: '/repos/goodboy', workspaceId: 'workspace-1' },
    });

    expect(run).toHaveBeenCalledWith(
      [
        'api',
        'repos/goodboy/goodboy/issues/42',
        '-X',
        'PATCH',
        '-f',
        'body=Rewritten from Goodboy.',
      ],
      { cwd: '/repos/goodboy', workspaceId: 'workspace-1' },
    );
    expect(body).toBe('Rewritten from Goodboy.');
  });

  it('raises the gh failure so the caller can keep the draft', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: 'HTTP 403: Resource not accessible by integration',
      exitCode: 1,
    });
    const runner: GhRunner = { run };

    await expect(
      updateIssueBody({
        runner,
        repoSlug: 'goodboy/goodboy',
        issueNumber: 42,
        body: 'nope',
      }),
    ).rejects.toThrow(/exited with 1/);
  });
});
