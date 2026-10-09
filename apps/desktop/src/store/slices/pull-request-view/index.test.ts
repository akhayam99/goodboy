// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  run: vi.fn(async (_args: ReadonlyArray<string>, _opts: unknown) => ({
    exitCode: 0,
    stdout: '{}',
    stderr: '',
  })),
}));

vi.mock('../../../features/integrations/github/github', () => ({ tauriGhRunner: { run: h.run } }));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { SessionGithubState } from '../../types';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;
const STAMP = '2026-10-07T08:00:00.000Z' as IsoDateTime;

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: '/worktrees/payments-api',
  lastWorktreePath: '/worktrees/payments-api',
  repoRoot: '/repos/payments-api',
  branch: 'ak/fix-credit',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/fix-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: STAMP,
};

const GITHUB: SessionGithubState = {
  pr: PR,
  linkedIssues: [],
  fetchedAt: STAMP,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
};

const VIEW_JSON = {
  number: 318,
  title: PR.title,
  body: '',
  url: PR.url,
  state: 'OPEN',
  isDraft: false,
  author: { login: 'nadia-p' },
  baseRefName: 'main',
  headRefName: 'ak/fix-credit',
  createdAt: '2026-09-26T08:00:00Z',
  updatedAt: '2026-10-06T08:00:00Z',
  mergeable: 'MERGEABLE',
  reviewDecision: null,
  autoMergeRequest: null,
  closingIssuesReferences: [],
  commits: [],
  files: [],
};

const answer = (args: ReadonlyArray<string>) => {
  const joined = args.join(' ');
  if (joined.includes('closingIssuesReferences')) {
    return { exitCode: 0, stdout: JSON.stringify(VIEW_JSON), stderr: '' };
  }
  if (args[0] === 'repo') {
    return {
      exitCode: 0,
      stdout: JSON.stringify({
        squashMergeAllowed: true,
        mergeCommitAllowed: false,
        rebaseMergeAllowed: true,
      }),
      stderr: '',
    };
  }
  return { exitCode: 0, stdout: '{}', stderr: '' };
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.run.mockReset();
  h.run.mockImplementation(async (args) => answer(args));
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: 'workspace-1' as WorkspaceId })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api' })],
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionGithub: { [SESSION_ID]: GITHUB },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const load = (force = false) =>
  useAppStore.getState().loadPullRequestView({ sessionId: SESSION_ID, force });

const viewCalls = (): number =>
  h.run.mock.calls.filter(([args]) => args.join(' ').includes('closingIssuesReferences')).length;

describe('the pull request view slice', () => {
  it('reads the view once and keeps it with the merge methods the repository allows', async () => {
    await load();

    const entry = useAppStore.getState().pullRequestViews[SESSION_ID];
    expect(entry?.prNumber).toBe(318);
    expect(entry?.isLoading).toBe(false);
    expect(entry?.error).toBeNull();
    expect(entry?.view?.mergeMethods).toEqual(['squash', 'rebase']);
    expect(entry?.view?.mergeMethodReasons).toEqual({ merge: 'Turned off in payments-api' });
  });

  it('does not read again within a minute, and reads again when forced', async () => {
    await load();
    await load();
    expect(viewCalls()).toBe(1);

    await load(true);
    expect(viewCalls()).toBe(2);
  });

  it('reads again once the view is older than a minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T08:00:00Z'));
    await load();
    vi.setSystemTime(new Date('2026-10-07T08:02:00Z'));
    await load();

    expect(viewCalls()).toBe(2);
  });

  it('marks the entry as loading while the read runs', async () => {
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    h.run.mockImplementation(async (args) => {
      await gate;
      return answer(args);
    });

    const pending = load();
    expect(useAppStore.getState().pullRequestViews[SESSION_ID]?.isLoading).toBe(true);
    open();
    await pending;

    expect(useAppStore.getState().pullRequestViews[SESSION_ID]?.isLoading).toBe(false);
  });

  it('keeps the error and the last view when a read fails', async () => {
    await load();
    h.run.mockImplementation(async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'HTTP 502: Bad Gateway',
    }));
    await load(true);

    const entry = useAppStore.getState().pullRequestViews[SESSION_ID];
    expect(entry?.error).toContain('HTTP 502');
    expect(entry?.view?.number).toBe(318);
    expect(entry?.isLoading).toBe(false);
  });

  it('reads nothing while the session has no pull request', async () => {
    useAppStore.setState({ sessionGithub: {} });

    await load();

    expect(h.run).not.toHaveBeenCalled();
    expect(useAppStore.getState().pullRequestViews[SESSION_ID]).toBeUndefined();
  });

  it('notes an edit of this session on the entry, in order', () => {
    useAppStore.getState().notePullRequestEdit({
      sessionId: SESSION_ID,
      prNumber: 318,
      what: 'title',
    });
    useAppStore.getState().notePullRequestEdit({
      sessionId: SESSION_ID,
      prNumber: 318,
      what: 'description',
    });

    expect(
      useAppStore.getState().pullRequestViews[SESSION_ID]?.edits.map((edit) => edit.what),
    ).toEqual(['title', 'description']);
  });

  it('keeps the edits when the view is read again', async () => {
    useAppStore.getState().notePullRequestEdit({
      sessionId: SESSION_ID,
      prNumber: 318,
      what: 'description',
    });

    await load(true);

    expect(useAppStore.getState().pullRequestViews[SESSION_ID]?.edits).toHaveLength(1);
    expect(useAppStore.getState().pullRequestViews[SESSION_ID]?.view?.number).toBe(318);
  });
});
