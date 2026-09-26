import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import {
  sentryConnect,
  sentryValidateConnection,
  sentryFetchIssueDetail,
  sentryFetchIssues,
  sentryListOrganizations,
  sentryListCodeMappings,
  sentryListProjects,
} from './client';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const WS = 'ws-1' as WorkspaceId;
const CRED = 'cred-1' as IntegrationCredentialId;
const mockInvoke = vi.mocked(invoke);

afterEach(() => {
  mockInvoke.mockReset();
});

describe('sentryValidateConnection', () => {
  it('probes the org and project under a credential id', async () => {
    mockInvoke.mockResolvedValue({ slug: 'p', name: 'P', organization: { slug: 'o', name: 'O' } });
    await sentryValidateConnection(CRED, 'tok', 'org', 'proj');
    expect(mockInvoke).toHaveBeenCalledWith('sentry_validate_connection', {
      credentialId: CRED,
      token: 'tok',
      org: 'org',
      project: 'proj',
    });
  });

  it('reuses a stored credential without carrying its token', async () => {
    mockInvoke.mockResolvedValue({ slug: 'p', name: 'P', organization: { slug: 'o', name: 'O' } });
    await sentryValidateConnection(CRED, null, 'org', 'proj');
    expect(mockInvoke).toHaveBeenCalledWith('sentry_validate_connection', {
      credentialId: CRED,
      token: null,
      org: 'org',
      project: 'proj',
    });
  });
});

describe('sentryConnect', () => {
  it('stores the secret under the credential id alone, with no project scope', async () => {
    await sentryConnect(CRED, 'tok');
    expect(mockInvoke).toHaveBeenCalledWith('sentry_connect', {
      credentialId: CRED,
      token: 'tok',
    });
  });
});

describe('sentryFetchIssues', () => {
  it('passes null for omitted query and cursor', async () => {
    mockInvoke.mockResolvedValue({ issues: [], next_cursor: null });
    await sentryFetchIssues(WS);
    expect(mockInvoke).toHaveBeenCalledWith('sentry_fetch_issues', {
      workspaceId: WS,
      query: null,
      cursor: null,
      sentryProject: null,
    });
  });

  it('forwards query and cursor when provided', async () => {
    mockInvoke.mockResolvedValue({ issues: [], next_cursor: null });
    await sentryFetchIssues(WS, 'is:unresolved', 'cur-1');
    expect(mockInvoke).toHaveBeenCalledWith('sentry_fetch_issues', {
      workspaceId: WS,
      query: 'is:unresolved',
      cursor: 'cur-1',
      sentryProject: null,
    });
  });
});

describe('sentryFetchIssueDetail', () => {
  it('invokes sentry_fetch_issue_detail with issue id', async () => {
    mockInvoke.mockResolvedValue({
      title: null,
      culprit: null,
      frames: [],
      tags: [],
      breadcrumbs: [],
    });
    await sentryFetchIssueDetail(WS, 'issue-9');
    expect(mockInvoke).toHaveBeenCalledWith('sentry_fetch_issue_detail', {
      workspaceId: WS,
      issueId: 'issue-9',
    });
  });
});

describe('sentry lookups', () => {
  it('lists the organizations and then the projects of one', async () => {
    mockInvoke.mockResolvedValueOnce([{ slug: 'northwind', name: 'Northwind' }]);
    mockInvoke.mockResolvedValueOnce([
      { id: '4501', slug: 'payments-api', name: 'payments-api', platform: 'python' },
    ]);

    const orgs = await sentryListOrganizations({ credentialId: CRED, token: 'sntryu_x' });
    const projects = await sentryListProjects({
      credentialId: CRED,
      token: null,
      org: 'northwind',
    });

    expect(orgs).toEqual([{ slug: 'northwind', name: 'Northwind' }]);
    expect(projects[0]?.slug).toBe('payments-api');
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'sentry_list_organizations', {
      credentialId: CRED,
      token: 'sntryu_x',
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'sentry_list_projects', {
      credentialId: CRED,
      token: null,
      org: 'northwind',
    });
  });
});

describe('sentry project links', () => {
  it('reads issues of a linked sentry project and the org code mappings', async () => {
    mockInvoke.mockResolvedValueOnce({ issues: [], next_cursor: null });
    mockInvoke.mockResolvedValueOnce([
      { projectSlug: 'payments-api', repoName: 'northwind/ledger-core' },
    ]);

    await sentryFetchIssues(WS, undefined, undefined, undefined, 'payments-api');
    const mappings = await sentryListCodeMappings({ workspaceId: WS });

    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'sentry_fetch_issues', {
      workspaceId: WS,
      query: null,
      cursor: null,
      sentryProject: 'payments-api',
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'sentry_list_code_mappings', { workspaceId: WS });
    expect(mappings[0]?.repoName).toBe('northwind/ledger-core');
  });
});
