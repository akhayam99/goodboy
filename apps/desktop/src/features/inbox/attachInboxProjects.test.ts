import { describe, expect, it } from 'vitest';
import type { Project, ProjectId, ProjectSentryLink } from '@goodboy/types';
import { attachInboxProjects } from './attachInboxProjects';
import type { InboxRecord } from './types';

const project = (id: string, rootPath: string): Project =>
  ({ id: id as ProjectId, name: id, rootPath, kind: 'repo' }) as Project;

const PROJECTS = [project('ledger', '/code/ledger-core'), project('store', '/code/storefront-web')];

const link = (projectId: string, sentryProject: string): ProjectSentryLink =>
  ({ projectId: projectId as ProjectId, sentryProject }) as ProjectSentryLink;

const sentry = (key: string, slug: string | null): InboxRecord =>
  ({
    key,
    provider: 'sentry',
    kind: 'error',
    payload: {
      provider: 'sentry',
      kind: 'error',
      issue: { id: key, project: slug === null ? null : { slug, name: slug } },
      sessionId: null,
    },
  }) as unknown as InboxRecord;

const other = (key: string, provider: 'github' | 'linear'): InboxRecord =>
  ({ key, provider, kind: 'issue', payload: { provider } }) as unknown as InboxRecord;

describe('attachInboxProjects', () => {
  it('gives code host records the project at the workspace root', () => {
    const [github, linear] = attachInboxProjects({
      records: [other('gh', 'github'), other('lin', 'linear')],
      projects: PROJECTS,
      rootPath: '/code/ledger-core',
      links: [],
    });
    expect(github?.projectIds).toEqual(['ledger']);
    expect(linear?.projectIds).toBeUndefined();
  });

  it('gives a sentry error every project linked to its sentry project', () => {
    const records = attachInboxProjects({
      records: [sentry('a', 'payments-api'), sentry('b', 'storefront-web'), sentry('c', null)],
      projects: PROJECTS,
      rootPath: '/code/elsewhere',
      links: [
        link('ledger', 'payments-api'),
        link('store', 'payments-api'),
        link('store', 'storefront-web'),
      ],
    });
    expect(records.map((record) => record.projectIds)).toEqual([
      ['ledger', 'store'],
      ['store'],
      undefined,
    ]);
  });
});
