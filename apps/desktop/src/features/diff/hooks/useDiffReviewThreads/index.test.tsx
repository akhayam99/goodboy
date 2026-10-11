// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { PrComment } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { MountGithubState } from '../../../../store/types';
import {
  CTX_PAYMENTS_ID,
  CTX_PAYMENTS_MOUNT_ID,
  CTX_SESSION_ID,
} from '../../../../app/components/MockScene/scenes/brand/contextBase';
import { seedResolveGitlabScene } from '../../../../app/components/MockScene/scenes/resolveGitlabSeed';
import { SESSION } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { useDiffReviewThreads } from './index';

const SESSION_ID = CTX_SESSION_ID;
const MOUNT_ID = CTX_PAYMENTS_MOUNT_ID;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type CommentParams = {
  readonly threadId: string;
  readonly resolved?: boolean;
  readonly outdated?: boolean;
  readonly onFile?: boolean;
  readonly id?: string;
  readonly createdAt?: string;
};

const comment = ({
  threadId,
  resolved = false,
  outdated = false,
  onFile = false,
  id = `c-${threadId}`,
  createdAt = '2026-09-27T10:00:00.000Z',
}: CommentParams): PrComment => ({
  id,
  author: 'kenji-w',
  authorAvatarUrl: null,
  body: 'Cap the retries at three.',
  createdAt,
  url: '',
  source: 'review',
  path: 'src/webhooks.ts',
  ...(onFile ? {} : { line: 42 }),
  resolved,
  outdated,
  threadId,
});

const githubMount = (comments: ReadonlyArray<PrComment>): MountGithubState => ({
  mountId: MOUNT_ID,
  projectId: CTX_PAYMENTS_ID,
  revision: 1,
  repository: 'harborline/payments-api',
  host: null,
  branch: 'hl/fix-duplicate-credit',
  prs: [],
  links: [],
  pr: {
    number: 318,
    title: 'Stop retried webhooks posting a second credit',
    url: 'https://example.invalid/harborline/payments-api/pull/318',
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: 'hl/fix-duplicate-credit',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-09-27T10:00:00.000Z',
  },
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: { prNumber: 318, comments, reviews: [], reviewRequests: [], checks: [] },
  detailFetchedAt: TEST_NOW,
  detailLoading: false,
  detailError: null,
});

const seed = (comments: ReadonlyArray<PrComment>): void => {
  useAppStore.setState({ mountGithub: { [MOUNT_ID]: githubMount(comments) } });
};

const read = () =>
  renderHook(() => useDiffReviewThreads({ sessionId: SESSION_ID, mountId: MOUNT_ID }));

describe('useDiffReviewThreads', () => {
  it('lists open and resolved threads as host threads and leaves outdated ones to Comments', () => {
    seed([
      comment({ threadId: 'PRRT_1' }),
      comment({ threadId: 'PRRT_2', resolved: true }),
      comment({ threadId: 'PRRT_3', outdated: true }),
    ]);

    const { result } = read();

    expect(result.current.threads.map((thread) => thread.id)).toEqual([
      'review:PRRT_1',
      'review:PRRT_2',
    ]);
    expect(result.current.threads[0]).toMatchObject({
      source: 'host',
      host: 'github',
      filePath: 'src/webhooks.ts',
      anchor: { side: 'new', lineNumber: 42 },
      statusLabel: 'Open',
      isResolved: false,
      canReply: true,
      canResolve: true,
      canEdit: false,
      canClose: false,
      canDelete: false,
    });
    expect(result.current.threads[1]).toMatchObject({ statusLabel: 'Resolved', isResolved: true });
  });

  it('puts a comment on the whole file under its header, with no line', () => {
    seed([comment({ threadId: 'PRRT_FILE', onFile: true })]);

    const { result } = read();

    expect(result.current.threads).toHaveLength(1);
    expect(result.current.threads[0]).toMatchObject({ id: 'review:PRRT_FILE', anchor: null });
  });

  it('carries the replies of a thread in order', () => {
    seed([
      comment({ threadId: 'PRRT_1', id: 'c-head' }),
      {
        ...comment({ threadId: 'PRRT_1', id: 'c-late', createdAt: '2026-09-27T12:00:00.000Z' }),
        author: 'maya-o',
        body: 'Done in 3f2a9c1',
      },
    ]);

    const { result } = read();

    expect(result.current.threads[0]?.replies).toEqual([
      { id: 'c-late', author: 'maya-o', body: 'Done in 3f2a9c1' },
    ]);
  });

  it('lists nothing for a mount with no pull request', () => {
    const { result } = read();

    expect(result.current.threads).toEqual([]);
  });

  it('reads the threads of a GitLab merge request through the review source', () => {
    seedResolveGitlabScene({ selected: 'gitlab' });

    const { result } = renderHook(() =>
      useDiffReviewThreads({ sessionId: SESSION.id, mountId: null }),
    );

    expect(result.current.threads.length).toBeGreaterThan(0);
    expect(result.current.threads.every((thread) => thread.host === 'gitlab')).toBe(true);
    expect(result.current.threads.every((thread) => thread.source === 'host')).toBe(true);
  });

  it('opens a thread in Comments through the review target', () => {
    seed([comment({ threadId: 'PRRT_1' })]);
    const openReviewTarget = vi.fn(async () => ({ kind: 'opened' as const }));
    useAppStore.setState({ openReviewTarget });
    const { result } = read();

    act(() => result.current.onOpenInComments('review:PRRT_1'));

    expect(openReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: MOUNT_ID, prNumber: 318, threadId: 'PRRT_1' },
    });
  });
});
