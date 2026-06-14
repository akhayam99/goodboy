import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';
import {
  sentryConnect,
  sentryDisconnect,
  sentryFetchIssueDetail,
  sentryFetchIssues,
} from './client';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const WS = 'ws-1' as WorkspaceId;
const mockInvoke = vi.mocked(invoke);

afterEach(() => {
  mockInvoke.mockReset();
});

describe('sentryConnect', () => {
  it('invokes sentry_connect with token, org and project', async () => {
    mockInvoke.mockResolvedValue({ slug: 'p', name: 'P', organization: { slug: 'o', name: 'O' } });
    await sentryConnect(WS, 'tok', 'org', 'proj');
    expect(mockInvoke).toHaveBeenCalledWith('sentry_connect', {
      workspaceId: WS,
      token: 'tok',
      org: 'org',
      project: 'proj',
    });
  });
});

describe('sentryDisconnect', () => {
  it('invokes sentry_disconnect with workspace id', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await sentryDisconnect(WS);
    expect(mockInvoke).toHaveBeenCalledWith('sentry_disconnect', { workspaceId: WS });
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

describe('sentryFetchIssueDetail', () => {
  it('invokes sentry_fetch_issue_detail with issue id', async () => {
    mockInvoke.mockResolvedValue({ title: null, culprit: null, frames: [] });
    await sentryFetchIssueDetail(WS, 'issue-9');
    expect(mockInvoke).toHaveBeenCalledWith('sentry_fetch_issue_detail', {
      workspaceId: WS,
      issueId: 'issue-9',
    });
  });
});
