import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import {
  sentryConnect,
  sentryValidateConnection,
  sentryFetchIssue,
  sentryFetchIssueDetail,
  sentryFetchIssues,
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
    });
  });

  it('forwards query and cursor when provided', async () => {
    mockInvoke.mockResolvedValue({ issues: [], next_cursor: null });
    await sentryFetchIssues(WS, 'is:unresolved', 'cur-1');
    expect(mockInvoke).toHaveBeenCalledWith('sentry_fetch_issues', {
      workspaceId: WS,
      query: 'is:unresolved',
      cursor: 'cur-1',
    });
  });
});

describe('sentryFetchIssue', () => {
  it('invokes sentry_fetch_issue with issue id', async () => {
    mockInvoke.mockResolvedValue({ id: 'issue-9', title: 'Boom' });
    await sentryFetchIssue({ workspaceId: WS, issueId: 'issue-9' });
    expect(mockInvoke).toHaveBeenCalledWith('sentry_fetch_issue', {
      workspaceId: WS,
      issueId: 'issue-9',
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
