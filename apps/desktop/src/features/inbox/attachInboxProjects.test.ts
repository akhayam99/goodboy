import { describe, expect, it } from 'vitest';
import type { Project, ProjectId, ProjectSentryLink } from '@goodboy/types';
import { attachInboxProjects } from './attachInboxProjects';
import type { InboxRecord } from './types';

const project = (id: string, rootPath: string, remoteUrl?: string): Project =>
  ({
    id: id as ProjectId,
    name: id,
    rootPath,
    kind: 'repo',
    ...(remoteUrl === undefined ? {} : { remoteUrl }),
  }) as Project;

const PROJECTS = [project('ledger', '/code/ledger-core'), project('store', '/code/storefront-web')];

const GITHUB_PROJECTS = [
  project('ledger', '/code/ledger-core', 'git@github.com:acme/ledger-core.git'),
  project('relay', '/code/notify-relay', 'https://github.com/Acme/notify-relay'),
  project('docs', '/code/docs'),
];

const githubRecord = (key: string, url: string): InboxRecord =>
  ({
    key,
    provider: 'github',
    kind: 'issue',
    url,
    payload: { provider: 'github' },
  }) as unknown as InboxRecord;

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
  it('gives a github item its project even when only one project has a github remote', () => {
    const [github, linear] = attachInboxProjects({
      records: [
        githubRecord('gh', 'https://github.com/acme/ledger-core/issues/4'),
        other('lin', 'linear'),
      ],
      projects: [GITHUB_PROJECTS[0] as Project, project('docs', '/code/docs')],
      links: [],
    });
    expect(github?.projectIds).toEqual(['ledger']);
    expect(linear?.projectIds).toBeUndefined();
  });

  it('gives a github item the project whose remote is its repo when several have one', () => {
    const records = attachInboxProjects({
      records: [
        githubRecord('a', 'https://github.com/acme/ledger-core/issues/4'),
        githubRecord('b', 'https://github.com/acme/notify-relay/pull/9'),
        githubRecord('c', 'https://github.com/acme/elsewhere/issues/1'),
        other('lin', 'linear'),
      ],
      projects: GITHUB_PROJECTS,
      links: [],
    });
    expect(records.map((record) => record.projectIds)).toEqual([
      ['ledger'],
      ['relay'],
      undefined,
      undefined,
    ]);
  });

  it('never gives a tracker item a project', () => {
    const [linear] = attachInboxProjects({
      records: [other('lin', 'linear')],
      projects: GITHUB_PROJECTS,
      links: [link('ledger', 'payments-api')],
    });
    expect(linear?.projectIds).toBeUndefined();
  });

  it('gives a sentry error every project linked to its sentry project', () => {
    const records = attachInboxProjects({
      records: [sentry('a', 'payments-api'), sentry('b', 'storefront-web'), sentry('c', null)],
      projects: PROJECTS,
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
