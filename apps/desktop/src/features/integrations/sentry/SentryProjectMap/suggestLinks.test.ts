import { describe, expect, it } from 'vitest';
import type { Project, ProjectId, ProjectSentryLink } from '@goodboy/types';
import { suggestLinks } from './suggestLinks';

const project = (id: string, name: string, rootPath: string): Project =>
  ({ id: id as ProjectId, name, rootPath, kind: 'repo' }) as Project;

const PROJECTS = [
  project('ledger', 'ledger-core', '/code/ledger-core'),
  project('store', 'Storefront', '/code/storefront-web'),
];

describe('suggestLinks', () => {
  it('matches a code mapping repo to a project by name or folder', () => {
    const suggestions = suggestLinks({
      projects: PROJECTS,
      links: [],
      mappings: [
        {
          projectSlug: 'payments-api',
          repoName: 'northwind/ledger-core',
          stackRoot: '',
          sourceRoot: '',
        },
        {
          projectSlug: 'payments-worker',
          repoName: 'northwind/ledger-core',
          stackRoot: '',
          sourceRoot: '',
        },
        {
          projectSlug: 'storefront-web',
          repoName: 'northwind/storefront-web',
          stackRoot: '',
          sourceRoot: '',
        },
        {
          projectSlug: 'notify-relay',
          repoName: 'northwind/notify-relay',
          stackRoot: '',
          sourceRoot: '',
        },
      ],
    });

    expect(suggestions.map((item) => [item.projectId, item.sentryProject])).toEqual([
      ['ledger', 'payments-api'],
      ['ledger', 'payments-worker'],
      ['store', 'storefront-web'],
    ]);
  });

  it('skips links that already exist and mappings without a repo', () => {
    const links = [
      { projectId: 'ledger' as ProjectId, sentryProject: 'payments-api' },
    ] as unknown as ReadonlyArray<ProjectSentryLink>;
    const suggestions = suggestLinks({
      projects: PROJECTS,
      links,
      mappings: [
        {
          projectSlug: 'payments-api',
          repoName: 'northwind/ledger-core',
          stackRoot: null,
          sourceRoot: null,
        },
        { projectSlug: 'payments-api', repoName: null, stackRoot: null, sourceRoot: null },
      ],
    });

    expect(suggestions).toEqual([]);
  });
});
