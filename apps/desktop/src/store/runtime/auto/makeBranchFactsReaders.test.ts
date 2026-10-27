// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { BranchFactsRequest } from '@goodboy/core';
import {
  brandId,
  type MountId,
  type PrComment,
  type ProjectId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import { makeBranchFactsReaders } from './makeBranchFactsReaders';
import type { ReadBranchFactsParams } from './ports';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-ledger-core' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger-core' });
const WORKTREE = '/work/harborline/ledger-core';

const PARAMS: ReadBranchFactsParams = {
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  worktreePath: WORKTREE,
  branch: 'ak/ledger-export',
};

const commentOf = (extra: Partial<PrComment>): PrComment => ({
  id: 'comment-1',
  author: 'northwind-dev',
  authorAvatarUrl: null,
  body: 'rename it',
  createdAt: '2026-10-19T09:00:00Z',
  url: 'https://github.com/harborline/ledger-core/pull/421#discussion_r1',
  source: 'review',
  path: 'src/export.ts',
  ...extra,
});

type StateParams = {
  readonly baseBranch: string | null;
  readonly patch?: Readonly<Record<string, unknown>>;
};

const stateOf = ({ baseBranch, patch = {} }: StateParams): AppStore =>
  Object.assign({}, useAppStore.getInitialState(), {
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'ledger-core' })],
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          mountName: 'ledger-core',
          worktreePath: WORKTREE,
          lastWorktreePath: WORKTREE,
          repoRoot: '/repos/ledger-core',
          branch: 'ak/ledger-export',
          baseBranch,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
    ...patch,
  });

const requestOf = (host: BranchFactsRequest['host']): BranchFactsRequest => ({
  host,
  number: 421,
  title: 'Export the ledger',
  url:
    host === 'github'
      ? 'https://github.com/harborline/ledger-core/pull/421'
      : 'https://gitlab.example.com/harborline/ledger-core/-/merge_requests/421',
  state: 'open',
  isDraft: false,
  baseBranch: 'main',
  headBranch: 'ak/ledger-export',
});

describe('the commits of a branch since its base', () => {
  it('reads from the remote tracking ref of the base', async () => {
    const commitRange = vi.fn(async () => [{ sha: 'abc123def', subject: 'feat: export' }]);
    const readers = makeBranchFactsReaders({
      getState: () => stateOf({ baseBranch: 'main' }),
      commitRange,
    });
    expect(await readers.commits(PARAMS)).toEqual([{ sha: 'abc123def', subject: 'feat: export' }]);
    expect(commitRange).toHaveBeenCalledWith({
      worktreePath: WORKTREE,
      base: 'origin/main',
      head: 'HEAD',
    });
  });

  it('falls back to the local base when the remote ref is missing', async () => {
    const commitRange = vi
      .fn()
      .mockRejectedValueOnce(new Error('unknown revision origin/main'))
      .mockResolvedValueOnce([{ sha: 'fff000111', subject: 'fix: local' }]);
    const readers = makeBranchFactsReaders({
      getState: () => stateOf({ baseBranch: 'main' }),
      commitRange,
    });
    expect(await readers.commits(PARAMS)).toEqual([{ sha: 'fff000111', subject: 'fix: local' }]);
    expect(commitRange).toHaveBeenLastCalledWith({
      worktreePath: WORKTREE,
      base: 'main',
      head: 'HEAD',
    });
  });

  it('fails with a reason when the mount has no base branch', async () => {
    const commitRange = vi.fn();
    const readers = makeBranchFactsReaders({
      getState: () => stateOf({ baseBranch: null }),
      commitRange,
    });
    await expect(readers.commits(PARAMS)).rejects.toThrow('this mount has no base branch');
    expect(commitRange).not.toHaveBeenCalled();
  });
});

describe('the open review threads of a request', () => {
  const refreshReviewSource = vi.fn(async () => undefined);

  it('keeps root comments that are not resolved, on GitHub', async () => {
    const readers = makeBranchFactsReaders({
      getState: () =>
        stateOf({
          baseBranch: 'main',
          patch: {
            refreshReviewSource,
            sessionGithub: {
              [SESSION_ID]: {
                pr: { number: 421 },
                detail: {
                  comments: [
                    commentOf({ id: 'a' }),
                    commentOf({ id: 'b', resolved: true }),
                    commentOf({ id: 'c', inReplyToId: 'a' }),
                    commentOf({ id: 'd', source: 'issue' }),
                  ],
                },
              },
            },
          },
        }),
      commitRange: vi.fn(),
    });
    const threads = await readers.threads({ params: PARAMS, request: requestOf('github') });
    expect(threads).toEqual([
      { author: 'northwind-dev', path: 'src/export.ts', body: 'rename it', isResolved: false },
    ]);
    expect(refreshReviewSource).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      force: true,
      silent: true,
    });
  });

  it('refuses a GitHub request that is not the one open in the conversation', async () => {
    const readers = makeBranchFactsReaders({
      getState: () =>
        stateOf({
          baseBranch: 'main',
          patch: {
            refreshReviewSource,
            sessionGithub: {
              [SESSION_ID]: { pr: { number: 99 }, detail: null },
            },
          },
        }),
      commitRange: vi.fn(),
    });
    await expect(readers.threads({ params: PARAMS, request: requestOf('github') })).rejects.toThrow(
      'not the one open in this conversation',
    );
  });

  it('reads the stored threads of a merge request on GitLab', async () => {
    const request = requestOf('gitlab');
    const readers = makeBranchFactsReaders({
      getState: () =>
        stateOf({
          baseBranch: 'main',
          patch: {
            refreshReviewSource,
            reviewSourceThreads: {
              [SESSION_ID]: {
                [request.url]: {
                  comments: [commentOf({ id: 'a', author: 'acme-dev' })],
                  fetchedAt: '2026-10-19T09:00:00Z',
                  loading: false,
                  error: null,
                },
              },
            },
          },
        }),
      commitRange: vi.fn(),
    });
    expect(await readers.threads({ params: PARAMS, request })).toMatchObject([
      { author: 'acme-dev' },
    ]);
  });

  it('reports the host error when the threads were never fetched', async () => {
    const request = requestOf('gitlab');
    const readers = makeBranchFactsReaders({
      getState: () =>
        stateOf({
          baseBranch: 'main',
          patch: {
            refreshReviewSource,
            reviewSourceThreads: {
              [SESSION_ID]: {
                [request.url]: {
                  comments: [],
                  fetchedAt: null,
                  loading: false,
                  error: 'rate limited',
                },
              },
            },
          },
        }),
      commitRange: vi.fn(),
    });
    await expect(readers.threads({ params: PARAMS, request })).rejects.toThrow('rate limited');
  });
});
