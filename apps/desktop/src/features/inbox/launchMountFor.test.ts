import { describe, expect, it } from 'vitest';
import type { Project, ProjectId, ProjectSentryLink } from '@goodboy/types';
import type { SentryCodeMapping } from '../integrations/sentry/client';
import { launchMountFor } from './launchMountFor';
import { launchMountSourceOf } from './launchMountSourceOf';
import type { InboxRecord } from './types';

const project = (id: string, name: string, remoteUrl?: string): Project =>
  ({
    id: id as ProjectId,
    name,
    rootPath: `/code/${name}`,
    kind: 'repo',
    ...(remoteUrl === undefined ? {} : { remoteUrl }),
  }) as Project;

const PROJECTS = [
  project('ledger', 'ledger-core', 'git@github.com:acme/ledger-core.git'),
  project('pay', 'payments-api', 'https://github.com/acme/payments-api'),
  project('relay', 'notify-relay'),
];

const link = (projectId: string, sentryProject: string): ProjectSentryLink =>
  ({ projectId: projectId as ProjectId, sentryProject }) as ProjectSentryLink;

const mapping = (projectSlug: string, repoName: string): SentryCodeMapping => ({
  projectSlug,
  repoName,
  stackRoot: null,
  sourceRoot: null,
});

const sentry = (slug: string | null): InboxRecord =>
  ({
    key: `sentry:error:${slug ?? 'none'}`,
    provider: 'sentry',
    kind: 'error',
    url: 'https://harborline.sentry.io/issues/1/',
    payload: {
      provider: 'sentry',
      kind: 'error',
      issue: { id: '1', project: slug === null ? null : { slug, name: slug } },
      sessionId: null,
    },
  }) as unknown as InboxRecord;

const github = (url: string): InboxRecord =>
  ({
    key: `github:issue:${url}`,
    provider: 'github',
    kind: 'issue',
    url,
    payload: { provider: 'github' },
  }) as unknown as InboxRecord;

const linear = {
  key: 'linear:issue:1',
  provider: 'linear',
  kind: 'issue',
  url: 'https://linear.app/northwind/issue/NW-4',
  payload: { provider: 'linear' },
} as unknown as InboxRecord;

const resolve = (
  record: InboxRecord,
  extra: {
    readonly links?: ReadonlyArray<ProjectSentryLink>;
    readonly mappings?: ReadonlyArray<SentryCodeMapping>;
  } = {},
) =>
  launchMountFor({
    source: launchMountSourceOf({ record }),
    projects: PROJECTS,
    links: extra.links ?? [],
    mappings: extra.mappings ?? [],
    gitlabHosts: [],
  });

describe('launchMountFor', () => {
  it('mounts the one project linked to the sentry project', () => {
    expect(resolve(sentry('payments-api'), { links: [link('pay', 'payments-api')] })).toEqual({
      options: [{ projectId: 'pay', name: 'payments-api' }],
      selectedId: 'pay',
      reason: 'from Sentry project payments-api',
    });
  });

  it('mounts the project a sentry code mapping points at', () => {
    const mount = resolve(sentry('payments-api'), {
      mappings: [mapping('payments-api', 'acme/ledger-core')],
    });
    expect(mount?.selectedId).toBe('ledger');
    expect(mount?.options).toHaveLength(1);
  });

  it('preselects the best of several sentry matches and keeps the rest to choose from', () => {
    const mount = resolve(sentry('payments-api'), {
      links: [link('ledger', 'payments-api'), link('pay', 'payments-api')],
      mappings: [mapping('payments-api', 'acme/payments-api')],
    });
    expect(mount?.selectedId).toBe('pay');
    expect(mount?.options.map((option) => option.projectId)).toEqual(['pay', 'ledger']);
  });

  it('mounts nothing when no project matches the sentry project', () => {
    expect(resolve(sentry('storefront-web'), { links: [link('pay', 'payments-api')] })).toBeNull();
    expect(resolve(sentry(null))).toBeNull();
  });

  it('mounts the project whose remote is the github repo', () => {
    expect(resolve(github('https://github.com/Acme/ledger-core/issues/7'))).toEqual({
      options: [{ projectId: 'ledger', name: 'ledger-core' }],
      selectedId: 'ledger',
      reason: 'from GitHub repo acme/ledger-core',
    });
    expect(resolve(github('https://github.com/acme/elsewhere/issues/7'))).toBeNull();
  });

  it('never mounts a project for a tracker issue', () => {
    expect(resolve(linear, { links: [link('pay', 'payments-api')] })).toBeNull();
  });
});
