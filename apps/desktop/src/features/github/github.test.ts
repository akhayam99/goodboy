import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  detectRepoSlug: vi.fn(),
  ghRunJson: vi.fn(),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...actual,
    detectRepoSlug: h.detectRepoSlug,
    ghRunJson: h.ghRunJson,
  };
});

import { ghIssueByNumber } from './github';

afterEach(() => {
  h.detectRepoSlug.mockReset();
  h.ghRunJson.mockReset();
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
