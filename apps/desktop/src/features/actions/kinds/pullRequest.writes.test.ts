import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { MountId, PullRequestState, SessionProjectMount } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { PULL_REQUEST_KIND } from './pullRequest';
import { pullRequestFacts } from './pullRequestFacts';
import type { ActionEnv } from '../types';

vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

const WORKSPACE = aWorkspace();
const LEDGER = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });
const PAYMENTS = aProject({ workspaceId: WORKSPACE.id, name: 'payments-api' });
const SESSION = aSession({ workspaceId: WORKSPACE.id });
const mountOf = ({ name }: { readonly name: string }): MountId => JSON.parse(JSON.stringify(name));
const LEDGER_MOUNT = mountOf({ name: 'mount-ledger-core' });
const PAYMENTS_MOUNT = mountOf({ name: 'mount-payments-api' });

type RepoMountParams = {
  readonly mountId: MountId;
  readonly projectId: typeof LEDGER.id;
  readonly name: string;
  readonly parallelIndex: number;
};

const repoMountOf = ({
  mountId,
  projectId,
  name,
  parallelIndex,
}: RepoMountParams): SessionProjectMount => ({
  mountId,
  sessionId: SESSION.id,
  projectId,
  mountName: name,
  worktreePath: `/worktrees/${name}`,
  lastWorktreePath: `/worktrees/${name}`,
  repoRoot: `/repos/${name}`,
  branch: 'hl/fix-credit',
  baseBranch: 'main',
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const prOf = ({ state }: { readonly state: PullRequestState['state'] }): PullRequestState => ({
  number: 12,
  title: 'Guard duplicate credits',
  url: 'https://github.com/harborline/payments-api/pull/12',
  state,
  isDraft: state === 'draft',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-credit',
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-07T08:00:00Z',
});

let store: StoryStore;
const refreshSessionPr = vi.fn(async () => undefined);
const refreshSessionPrDetail = vi.fn(async () => undefined);
const loadPullRequestView = vi.fn(async () => undefined);

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  refreshSessionPr.mockClear();
  refreshSessionPrDetail.mockClear();
  loadPullRequestView.mockClear();
  stubStoryInvoke({ gh_run: { stdout: '', stderr: '', exitCode: 0 } });
  store.setState({
    workspaces: [WORKSPACE],
    projects: [LEDGER, PAYMENTS],
    sessions: [SESSION],
    sessionActiveMount: { [SESSION.id]: LEDGER_MOUNT },
    sessionActiveProject: { [SESSION.id]: LEDGER.id },
    sessionProjectMounts: {
      [SESSION.id]: [
        repoMountOf({
          mountId: LEDGER_MOUNT,
          projectId: LEDGER.id,
          name: 'ledger-core',
          parallelIndex: 0,
        }),
        repoMountOf({
          mountId: PAYMENTS_MOUNT,
          projectId: PAYMENTS.id,
          name: 'payments-api',
          parallelIndex: 0,
        }),
      ],
    },
    refreshSessionPr,
    refreshSessionPrDetail,
    loadPullRequestView,
  });
});

const env = (): ActionEnv => ({
  getState: store.getState,
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
});

type RunParams = {
  readonly id: string;
  readonly state: PullRequestState['state'];
  readonly choice?: string | null;
};

const runOnShownMount = async ({ id, state, choice = null }: RunParams) => {
  const action = PULL_REQUEST_KIND.actions.find((candidate) => candidate.id === id);
  if (action === undefined) {
    throw new Error(`Missing action ${id}`);
  }
  const facts = pullRequestFacts({
    sessionId: SESSION.id,
    mountId: PAYMENTS_MOUNT,
    pr: prOf({ state }),
    checks: [],
    comments: [],
    reviews: [],
    viewer: null,
    writeInFlight: null,
    isScribeWriting: false,
  });
  await action.run({ facts, env: env(), choice });
};

const ghCallCount = () =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'gh_run').length;

describe('a pull request write goes to the repository of the mount on screen', () => {
  it.each([
    { id: 'pullRequest.markReady', state: 'draft', args: ['pr', 'ready', '12'] },
    {
      id: 'pullRequest.merge',
      state: 'open',
      args: ['pr', 'merge', '12', '--squash'],
    },
    { id: 'pullRequest.reopen', state: 'closed', args: ['pr', 'reopen', '12'] },
    { id: 'pullRequest.convertToDraft', state: 'open', args: ['pr', 'ready', '12', '--undo'] },
    { id: 'pullRequest.close', state: 'open', args: ['pr', 'close', '12'] },
  ] as const)(
    '$id runs in payments-api while ledger-core has a pull request 12 too',
    async ({ id, state, args }) => {
      await runOnShownMount({ id, state });

      expect(ghCallCount()).toBe(1);
      expect(storySpies.tauriInvoke).toHaveBeenCalledWith(
        'gh_run',
        expect.objectContaining({ args, cwd: '/repos/payments-api', projectId: PAYMENTS.id }),
      );
    },
  );

  it.each([
    { id: 'pullRequest.markReady', state: 'draft' },
    { id: 'pullRequest.merge', state: 'open' },
    { id: 'pullRequest.reopen', state: 'closed' },
    { id: 'pullRequest.convertToDraft', state: 'open' },
    { id: 'pullRequest.close', state: 'open' },
  ] as const)('$id reads the shown mount again once the host answered', async ({ id, state }) => {
    await runOnShownMount({ id, state });

    expect(refreshSessionPr).toHaveBeenCalledWith(SESSION.id, {
      force: true,
      mountId: PAYMENTS_MOUNT,
    });
    expect(refreshSessionPrDetail).toHaveBeenCalledWith(SESSION.id, {
      force: true,
      mountId: PAYMENTS_MOUNT,
    });
    expect(loadPullRequestView).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      mountId: PAYMENTS_MOUNT,
      force: true,
    });
  });

  it('leaves the shown mount alone when the host refuses', async () => {
    stubStoryInvoke({ gh_run: { stdout: '', stderr: 'not mergeable', exitCode: 1 } });

    await expect(runOnShownMount({ id: 'pullRequest.close', state: 'open' })).rejects.toThrow();

    expect(refreshSessionPr).not.toHaveBeenCalled();
    expect(loadPullRequestView).not.toHaveBeenCalled();
  });
});
