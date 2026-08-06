import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  detectRepoSlug: vi.fn(),
  ghAssignedIssues: vi.fn(),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, detectRepoSlug: h.detectRepoSlug };
});

vi.mock('../github/github', () => ({
  tauriGhRunner: {},
  ghAssignedIssues: h.ghAssignedIssues,
}));

import { fetchIssueCandidates } from './fetchIssueCandidates';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

beforeEach(() => {
  h.detectRepoSlug.mockReset();
  h.ghAssignedIssues.mockReset();
  h.ghAssignedIssues.mockResolvedValue([]);
});

describe('fetchIssueCandidates for github', () => {
  it('explains itself instead of returning an unexplained empty list off a github remote', async () => {
    h.detectRepoSlug.mockResolvedValue(null);

    await expect(
      fetchIssueCandidates({
        provider: 'github',
        workspaceId: WORKSPACE_ID,
        rootPath: '/repo',
        gitlabHost: null,
        jiraConfig: null,
      }),
    ).rejects.toThrow(/No GitHub repository resolved/);
    expect(h.ghAssignedIssues).not.toHaveBeenCalled();
  });

  it('maps assigned issues when the repository resolves', async () => {
    h.detectRepoSlug.mockResolvedValue('acme/web');
    h.ghAssignedIssues.mockResolvedValue([
      {
        number: 42,
        title: 'Fix the router',
        body: '',
        url: 'https://github.com/acme/web/issues/42',
        state: 'OPEN',
        labels: [],
        updatedAt: '2026-08-01T00:00:00Z',
      },
    ]);

    const rows = await fetchIssueCandidates({
      provider: 'github',
      workspaceId: WORKSPACE_ID,
      rootPath: '/repo',
      gitlabHost: null,
      jiraConfig: null,
    });

    expect(rows.map((row) => row.identifier)).toEqual(['#42']);
  });
});
