import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectRepoSlug } from '@goodboy/core';
import type {
  GithubIssue,
  IsoDateTime,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { buildGithubIssueGroups, useGithubIssues } from './useGithubIssues';
import { ghAssignedIssues } from '../../github';
import { collectLinkedExternalIds } from '../../../hooks/useLinkedExternalIds';
import { deferred } from '../../../testing/deferred';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';

const WS_ONE = brandId<WorkspaceId>({ value: 'workspace-1' });
const WS_TWO = brandId<WorkspaceId>({ value: 'workspace-2' });

vi.mock('@goodboy/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/core')>()),
  detectRepoSlug: vi.fn(),
}));

vi.mock('../../github', () => ({
  ghAssignedIssues: vi.fn(),
  tauriGhRunner: {},
}));

const detectSlug = vi.mocked(detectRepoSlug);
const assignedIssues = vi.mocked(ghAssignedIssues);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  detectSlug.mockReset();
  detectSlug.mockResolvedValue('harborline/ledger-core');
  assignedIssues.mockReset();
});

afterEach(cleanup);

type IssueParams = {
  readonly number: number;
  readonly updatedAt: string;
};

type TaskParams = {
  readonly sessionId: SessionId;
  readonly externalId: string;
  readonly provider?: SessionExternalTask['provider'];
};

const makeIssue = ({ number, updatedAt }: IssueParams): GithubIssue => ({
  number,
  title: `Issue ${number}`,
  body: '',
  url: `https://github.com/goodboy/goodboy/issues/${number}`,
  state: 'OPEN',
  labels: [],
  updatedAt,
});

const makeTask = ({
  sessionId,
  externalId,
  provider = 'github',
}: TaskParams): SessionExternalTask => ({
  sessionId,
  provider,
  externalId,
  identifier: `#${externalId}`,
  url: `https://github.com/goodboy/goodboy/issues/${externalId}`,
  title: `Issue ${externalId}`,
  createdAt: '2026-07-20T10:00:00Z' as IsoDateTime,
});

describe('buildGithubIssueGroups', () => {
  it('maps GitHub issues to sessions and sorts newest first', () => {
    const sessionId = 'session-1' as SessionId;
    const groups = buildGithubIssueGroups({
      issues: [
        makeIssue({ number: 41, updatedAt: '2026-07-20T10:00:00Z' }),
        makeIssue({ number: 42, updatedAt: '2026-07-22T10:00:00Z' }),
        makeIssue({ number: 43, updatedAt: '2026-07-21T10:00:00Z' }),
      ],
      linkedSessions: collectLinkedExternalIds({
        sessionExternalTasks: {
          [sessionId]: [
            makeTask({ sessionId, externalId: '42' }),
            makeTask({ sessionId, externalId: '43', provider: 'gitlab' }),
          ],
        },
        providers: ['github'],
      }),
    });

    expect(groups[0]?.rows.map((row) => row.issue.number)).toEqual([42, 43, 41]);
    expect(groups[0]?.rows.map((row) => row.sessionId)).toEqual([sessionId, null, null]);
  });
});

describe('useGithubIssues late answers', () => {
  const idsOf = (groups: ReturnType<typeof useGithubIssues>['groups']) =>
    groups.flatMap((group) => group.rows.map((row) => row.issue.number));

  it('drops the answer of the workspace the user left', async () => {
    const slow = deferred<ReadonlyArray<GithubIssue>>();
    assignedIssues
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce([makeIssue({ number: 2, updatedAt: '2026-07-22T10:00:00Z' })]);
    const { result, rerender } = renderHook(
      ({ workspaceId }: { readonly workspaceId: WorkspaceId }) =>
        useGithubIssues({ workspaceId, rootPath: '/repos/ledger-core' }),
      { initialProps: { workspaceId: WS_ONE } },
    );

    await waitFor(() => expect(assignedIssues).toHaveBeenCalledOnce());

    rerender({ workspaceId: WS_TWO });
    await waitFor(() => expect(idsOf(result.current.groups)).toEqual([2]));
    await act(async () => {
      slow.resolve([makeIssue({ number: 1, updatedAt: '2026-07-21T10:00:00Z' })]);
    });

    expect(idsOf(result.current.groups)).toEqual([2]);
    expect(result.current.loading).toBe(false);
  });

  it('drops an answer that lands after the source was switched off', async () => {
    const slow = deferred<ReadonlyArray<GithubIssue>>();
    assignedIssues.mockReturnValueOnce(slow.promise);
    const { result, rerender } = renderHook(
      ({ isEnabled }: { readonly isEnabled: boolean }) =>
        useGithubIssues({
          workspaceId: WS_ONE,
          rootPath: '/repos/ledger-core',
          isEnabled,
        }),
      { initialProps: { isEnabled: true } },
    );
    await waitFor(() => expect(assignedIssues).toHaveBeenCalledOnce());

    rerender({ isEnabled: false });
    await act(async () => {
      slow.resolve([makeIssue({ number: 1, updatedAt: '2026-07-21T10:00:00Z' })]);
    });

    expect(result.current.groups).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('drops the failure of a load that a newer one replaced', async () => {
    const slow = deferred<ReadonlyArray<GithubIssue>>();
    assignedIssues
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce([makeIssue({ number: 2, updatedAt: '2026-07-22T10:00:00Z' })]);
    const { result } = renderHook(() =>
      useGithubIssues({
        workspaceId: WS_ONE,
        rootPath: '/repos/ledger-core',
      }),
    );
    await waitFor(() => expect(assignedIssues).toHaveBeenCalledOnce());

    act(() => result.current.refetch());
    await waitFor(() => expect(idsOf(result.current.groups)).toEqual([2]));
    await act(async () => {
      slow.reject(new Error('429 Too Many Requests'));
    });

    expect(result.current.error).toBeNull();
    expect(idsOf(result.current.groups)).toEqual([2]);
  });
});
