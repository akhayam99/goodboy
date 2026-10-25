import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IntegrationBindingId,
  IntegrationCredentialId,
  JiraIntegrationBinding,
  Session,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { aSession, TEST_NOW } from '@goodboy/types/testing';
import { jiraListIssues, type JiraIssue } from '../client';
import { resolveIssueSessions, useJiraIssues } from './useJiraIssues';
import { buildIssueGroups } from './buildIssueGroups';
import { jiraBranchSlug } from './jiraBranchSlug';
import { collectLinkedExternalIds } from '../../hooks/useLinkedExternalIds';
import { deferred } from '../../testing/deferred';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';

const WS_ONE = brandId<WorkspaceId>({ value: 'workspace-1' });
const WS_TWO = brandId<WorkspaceId>({ value: 'workspace-2' });

type BindingParams = {
  readonly workspaceId: WorkspaceId;
};

const jiraBindingOf = ({ workspaceId }: BindingParams): JiraIntegrationBinding => ({
  id: brandId<IntegrationBindingId>({ value: `binding-${workspaceId}` }),
  workspaceId,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-jira' }),
  provider: 'jira',
  config: { siteUrl: 'acme.atlassian.net', email: 'priya@acme.test', projectKey: 'ENG' },
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  jiraListIssues: vi.fn(),
}));

const listIssues = vi.mocked(jiraListIssues);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  const store = await importStore();
  await resetStoryStore();
  listIssues.mockReset();
  store.setState({
    workspaceIntegrations: {
      [WS_ONE]: [jiraBindingOf({ workspaceId: WS_ONE })],
      [WS_TWO]: [jiraBindingOf({ workspaceId: WS_TWO })],
    },
  });
});

afterEach(cleanup);

const issue = (overrides: Partial<JiraIssue>): JiraIssue =>
  ({
    id: '10042',
    key: 'ENG-142',
    summary: 'Session rail drops focus',
    statusCategory: 'new',
    updated: '2026-07-01T10:00:00.000Z',
    ...overrides,
  }) as JiraIssue;

const session = (id: string): Session => aSession({ id: id as SessionId });

describe('jiraBranchSlug', () => {
  it('lowercases the key and kebabs the summary', () => {
    expect(jiraBranchSlug({ issue: issue({}) })).toBe('eng-142-session-rail-drops-focus');
  });
});

describe('buildIssueGroups', () => {
  it('orders in-progress before to-do and done, newest first inside a group', () => {
    const groups = buildIssueGroups({
      issues: [
        issue({ id: '1', statusCategory: 'done' }),
        issue({ id: '2', statusCategory: 'new', updated: '2026-07-01T10:00:00.000Z' }),
        issue({ id: '3', statusCategory: 'new', updated: '2026-07-05T10:00:00.000Z' }),
        issue({ id: '4', statusCategory: 'indeterminate' }),
      ],
      sessionIdByExternalId: new Map(),
    });
    expect(groups.map((group) => group.label)).toEqual(['In progress', 'To do', 'Done']);
    expect(groups[1]?.rows.map((row) => row.issue.id)).toEqual(['3', '2']);
  });
});

describe('resolveIssueSessions', () => {
  it('matches a linked external task before falling back to the branch name', () => {
    const linked: SessionExternalTask = {
      provider: 'jira',
      externalId: '10042',
    } as SessionExternalTask;
    const byLink = resolveIssueSessions({
      issues: [issue({})],
      sessions: [session('sess-1')],
      sessionBranches: {},
      linkedSessions: collectLinkedExternalIds({
        sessionExternalTasks: { 'sess-1': [linked] },
        providers: ['jira'],
        sessions: [session('sess-1')],
      }),
    });
    const byBranch = resolveIssueSessions({
      issues: [issue({})],
      sessions: [session('sess-2')],
      sessionBranches: { 'sess-2': 'ak/eng-142-session-rail-drops-focus' },
      linkedSessions: new Map(),
    });
    expect(byLink.get('10042')).toBe('sess-1');
    expect(byBranch.get('10042')).toBe('sess-2');
  });
});

describe('useJiraIssues late answers', () => {
  const idsOf = (groups: ReturnType<typeof useJiraIssues>['groups']) =>
    groups.flatMap((group) => group.rows.map((row) => row.issue.id));

  it('drops the answer of the workspace the user left', async () => {
    const slow = deferred<ReadonlyArray<JiraIssue>>();
    listIssues.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([issue({ id: 'b' })]);
    const { result, rerender } = renderHook(
      ({ workspaceId }: { readonly workspaceId: WorkspaceId }) =>
        useJiraIssues({ workspaceId, isEnabled: true, assignedOnly: true }),
      { initialProps: { workspaceId: WS_ONE } },
    );

    rerender({ workspaceId: WS_TWO });
    await waitFor(() => expect(idsOf(result.current.groups)).toEqual(['b']));
    await act(async () => {
      slow.resolve([issue({ id: 'a' })]);
    });

    expect(idsOf(result.current.groups)).toEqual(['b']);
    expect(result.current.isLoading).toBe(false);
  });

  it('drops an answer that lands after the source was switched off', async () => {
    const slow = deferred<ReadonlyArray<JiraIssue>>();
    listIssues.mockReturnValueOnce(slow.promise);
    const { result, rerender } = renderHook(
      ({ isEnabled }: { readonly isEnabled: boolean }) =>
        useJiraIssues({ workspaceId: WS_ONE, isEnabled, assignedOnly: true }),
      { initialProps: { isEnabled: true } },
    );

    rerender({ isEnabled: false });
    await act(async () => {
      slow.resolve([issue({ id: 'a' })]);
    });

    expect(result.current.groups).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('drops the failure of a load that a newer one replaced', async () => {
    const slow = deferred<ReadonlyArray<JiraIssue>>();
    listIssues.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([issue({ id: 'b' })]);
    const { result } = renderHook(() =>
      useJiraIssues({
        workspaceId: WS_ONE,
        isEnabled: true,
        assignedOnly: true,
      }),
    );

    act(() => result.current.refetch());
    await waitFor(() => expect(idsOf(result.current.groups)).toEqual(['b']));
    await act(async () => {
      slow.reject(new Error('429 Too Many Requests'));
    });

    expect(result.current.error).toBeNull();
    expect(idsOf(result.current.groups)).toEqual(['b']);
  });
});
