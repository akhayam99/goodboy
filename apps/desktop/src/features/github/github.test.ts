import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

const h = vi.hoisted(() => ({
  detectRepoSlug: vi.fn(),
  ghRunJson: vi.fn(),
  updateIssueBody: vi.fn(),
  listIssueComments: vi.fn(),
  createIssueComment: vi.fn(),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...actual,
    detectRepoSlug: h.detectRepoSlug,
    ghRunJson: h.ghRunJson,
    updateIssueBody: h.updateIssueBody,
    listIssueComments: h.listIssueComments,
    createIssueComment: h.createIssueComment,
  };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import {
  ghCreateIssueComment,
  ghIssueByNumber,
  ghIssueComments,
  ghStatus,
  ghUpdateIssueBody,
} from './github';

const mockInvoke = vi.mocked(invoke);

afterEach(() => {
  h.detectRepoSlug.mockReset();
  h.ghRunJson.mockReset();
  h.updateIssueBody.mockReset();
  h.listIssueComments.mockReset();
  h.createIssueComment.mockReset();
  mockInvoke.mockReset();
});

describe('ghStatus', () => {
  it('passes the scoped flag through from the raw gh_status response', async () => {
    mockInvoke.mockResolvedValueOnce({
      available: true,
      mode: 'gh-cli',
      version: '2.60.0',
      user: 'octocat',
      scopes: [],
      scoped: false,
    });

    const status = await ghStatus('workspace-1');

    expect(status.mode).toBe('gh-cli');
    expect(status.scoped).toBe(false);
  });

  it('reports scoped true for a workspace personal access token', async () => {
    mockInvoke.mockResolvedValueOnce({
      available: true,
      mode: 'pat',
      version: null,
      user: 'octocat',
      scopes: ['repo'],
      scoped: true,
    });

    const status = await ghStatus('workspace-1');

    expect(status.mode).toBe('pat');
    expect(status.scoped).toBe(true);
  });
});

describe('ghIssueByNumber', () => {
  it('fetches a single issue by number for the detected repo', async () => {
    h.detectRepoSlug.mockResolvedValueOnce('acme/web');
    h.ghRunJson.mockResolvedValueOnce({
      number: 42,
      title: 'Fix the thing',
      body: 'Details',
      url: 'https://github.com/acme/web/issues/42',
      state: 'OPEN',
      labels: [{ name: 'bug' }],
      updatedAt: '2026-05-21T10:00:00Z',
    });

    const issue = await ghIssueByNumber('/repo', 42, 'workspace-1');

    expect(issue).toEqual({
      number: 42,
      title: 'Fix the thing',
      body: 'Details',
      url: 'https://github.com/acme/web/issues/42',
      state: 'OPEN',
      labels: ['bug'],
      updatedAt: '2026-05-21T10:00:00Z',
    });
    expect(h.ghRunJson).toHaveBeenCalledWith(
      expect.anything(),
      [
        'issue',
        'view',
        '42',
        '--repo',
        'acme/web',
        '--json',
        'number,title,body,url,state,labels,updatedAt',
      ],
      { cwd: '/repo', workspaceId: 'workspace-1' },
    );
  });

  it('throws when no github repository can be detected for the workspace', async () => {
    h.detectRepoSlug.mockResolvedValueOnce(null);

    await expect(ghIssueByNumber('/repo', 42)).rejects.toThrow(
      'could not detect a GitHub repository for this project',
    );
    expect(h.ghRunJson).not.toHaveBeenCalled();
  });
});

describe('ghIssueComments', () => {
  it('reads the comment thread of the detected repo', async () => {
    h.detectRepoSlug.mockResolvedValueOnce('acme/web');
    h.listIssueComments.mockResolvedValueOnce([]);

    await ghIssueComments({ cwd: '/repo', issueNumber: 42, workspaceId: 'workspace-1' });

    expect(h.listIssueComments).toHaveBeenCalledWith({
      runner: expect.anything(),
      repoSlug: 'acme/web',
      issueNumber: 42,
      opts: { cwd: '/repo', workspaceId: 'workspace-1' },
    });
  });

  it('throws when no github repository can be detected', async () => {
    h.detectRepoSlug.mockResolvedValueOnce(null);

    await expect(ghIssueComments({ cwd: '/repo', issueNumber: 42 })).rejects.toThrow(
      'could not detect a GitHub repository for this project',
    );
    expect(h.listIssueComments).not.toHaveBeenCalled();
  });
});

describe('ghCreateIssueComment', () => {
  it('posts the comment to the detected repo and returns it', async () => {
    h.detectRepoSlug.mockResolvedValueOnce('acme/web');
    h.createIssueComment.mockResolvedValueOnce({ id: '7', body: 'On it.' });

    const comment = await ghCreateIssueComment({
      cwd: '/repo',
      issueNumber: 42,
      body: 'On it.',
      workspaceId: 'workspace-1',
    });

    expect(comment).toEqual({ id: '7', body: 'On it.' });
    expect(h.createIssueComment).toHaveBeenCalledWith({
      runner: expect.anything(),
      repoSlug: 'acme/web',
      issueNumber: 42,
      body: 'On it.',
      opts: { cwd: '/repo', workspaceId: 'workspace-1' },
    });
  });

  it('throws without posting when no github repository can be detected', async () => {
    h.detectRepoSlug.mockResolvedValueOnce(null);

    await expect(
      ghCreateIssueComment({ cwd: '/repo', issueNumber: 42, body: 'On it.' }),
    ).rejects.toThrow('could not detect a GitHub repository for this project');
    expect(h.createIssueComment).not.toHaveBeenCalled();
  });
});

describe('ghUpdateIssueBody', () => {
  it('writes the new body to the detected repo and returns the stored text', async () => {
    h.detectRepoSlug.mockResolvedValueOnce('acme/web');
    h.updateIssueBody.mockResolvedValueOnce('New body');

    const body = await ghUpdateIssueBody({
      cwd: '/repo',
      issueNumber: 42,
      body: 'New body',
      workspaceId: 'workspace-1',
    });

    expect(body).toBe('New body');
    expect(h.updateIssueBody).toHaveBeenCalledWith({
      runner: expect.anything(),
      repoSlug: 'acme/web',
      issueNumber: 42,
      body: 'New body',
      opts: { cwd: '/repo', workspaceId: 'workspace-1' },
    });
  });

  it('throws without writing when no github repository can be detected', async () => {
    h.detectRepoSlug.mockResolvedValueOnce(null);

    await expect(ghUpdateIssueBody({ cwd: '/repo', issueNumber: 42, body: 'x' })).rejects.toThrow(
      'could not detect a GitHub repository for this project',
    );
    expect(h.updateIssueBody).not.toHaveBeenCalled();
  });
});
