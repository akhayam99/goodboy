import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  detectRepoSlug: vi.fn(),
  ghRunJson: vi.fn(),
  updateIssueBody: vi.fn(),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...actual,
    detectRepoSlug: h.detectRepoSlug,
    ghRunJson: h.ghRunJson,
    updateIssueBody: h.updateIssueBody,
  };
});

import { ghIssueByNumber, ghUpdateIssueBody } from './github';

afterEach(() => {
  h.detectRepoSlug.mockReset();
  h.ghRunJson.mockReset();
  h.updateIssueBody.mockReset();
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
      'could not detect a GitHub repository for this workspace',
    );
    expect(h.ghRunJson).not.toHaveBeenCalled();
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
      'could not detect a GitHub repository for this workspace',
    );
    expect(h.updateIssueBody).not.toHaveBeenCalled();
  });
});
