import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProjectId, ProjectSentryLink, WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());

const WORKSPACE_ID = 'ws-northwind' as WorkspaceId;

const link: ProjectSentryLink = {
  id: 'link-1',
  workspaceId: WORKSPACE_ID,
  projectId: 'project-ledger' as ProjectId,
  sentryOrg: 'northwind',
  sentryProject: 'ledger-core',
  sentryProjectName: 'ledger-core',
  source: 'manual',
  createdAt: '2026-09-20T00:00:00.000Z' as IsoDateTime,
};

const issue = (id: string) => ({
  id,
  shortId: id.toUpperCase(),
  title: `Boom ${id}`,
  culprit: null,
  level: 'error',
  status: 'unresolved',
  count: '1',
  userCount: 1,
  firstSeen: null,
  lastSeen: null,
  permalink: null,
  metadata: null,
});

type Deferred<T> = { readonly promise: Promise<T>; readonly resolve: (value: T) => void };

const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

type FetchArgs = { readonly sentryProject: string | null };

const fetchCalls = (): ReadonlyArray<FetchArgs> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([command]) => command === 'sentry_fetch_issues')
    .map(([, args]) => args as FetchArgs);

let useAppStore: StoryStore;
let useInboxSentryIssues: typeof import('./index').useInboxSentryIssues;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ useInboxSentryIssues } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

describe('useInboxSentryIssues', () => {
  beforeEach(async () => {
    await resetStoryStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('waits for the project links before the first fetch, so one load covers every linked project', async () => {
    const links = deferred<ReadonlyArray<ProjectSentryLink>>();
    storySpies.listProjectSentryLinks.mockImplementation(() => links.promise);
    storySpies.tauriInvoke.mockImplementation(async (command, args) => {
      if (command !== 'sentry_fetch_issues') {
        return null;
      }
      const slug = (args as FetchArgs).sentryProject;
      return { issues: [issue(slug ?? 'default')], next_cursor: null };
    });

    const { result } = renderHook(() =>
      useInboxSentryIssues({ workspaceId: WORKSPACE_ID, isEnabled: true }),
    );

    await waitFor(() => expect(result.current.sentry.loading).toBe(true));
    expect(fetchCalls()).toHaveLength(0);

    await act(async () => {
      links.resolve([link]);
    });

    await waitFor(() => expect(result.current.sentry.loading).toBe(false));
    expect(fetchCalls().map((call) => call.sentryProject)).toEqual([null, 'ledger-core']);
    expect(result.current.sentry.error).toBeNull();
    expect(result.current.sentry.rows.map((row) => row.issue.id).sort()).toEqual([
      'default',
      'ledger-core',
    ]);
    expect(useAppStore.getState().projectSentryLinks[WORKSPACE_ID]).toEqual([link]);
  });

  it('still loads when the project links cannot be read', async () => {
    storySpies.listProjectSentryLinks.mockRejectedValue(new Error('database is locked'));
    storySpies.tauriInvoke.mockImplementation(async (command) =>
      command === 'sentry_fetch_issues' ? { issues: [issue('default')], next_cursor: null } : null,
    );

    const { result } = renderHook(() =>
      useInboxSentryIssues({ workspaceId: WORKSPACE_ID, isEnabled: true }),
    );

    await waitFor(() => expect(result.current.sentry.rows).toHaveLength(1));
    expect(result.current.sentry.error).toBeNull();
    expect(fetchCalls()).toHaveLength(1);
  });

  it('shows the message of a rate-limited first load instead of [object Object]', async () => {
    storySpies.listProjectSentryLinks.mockResolvedValue([]);
    storySpies.tauriInvoke.mockImplementation(async (command) => {
      if (command !== 'sentry_fetch_issues') {
        return null;
      }
      throw { kind: 'http', message: 'http error: status 429 Too Many Requests' };
    });

    const { result } = renderHook(() =>
      useInboxSentryIssues({ workspaceId: WORKSPACE_ID, isEnabled: true }),
    );

    await waitFor(() =>
      expect(result.current.sentry.error).toBe('http error: status 429 Too Many Requests'),
    );
  });
});
