import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { listAssignedIssues } from '../issues';

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
