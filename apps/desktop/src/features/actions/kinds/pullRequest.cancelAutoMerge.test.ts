import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { MountId } from '@goodboy/types';
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
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import type { PullRequestHost, PullRequestState } from '@goodboy/types';

vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

const WORKSPACE = aWorkspace();
const PROJECT = aProject({ workspaceId: WORKSPACE.id, name: 'payments-api' });
const SESSION = aSession({ workspaceId: WORKSPACE.id });
const mountOf = ({ name }: { readonly name: string }): MountId => JSON.parse(JSON.stringify(name));
const MOUNT = mountOf({ name: 'mount-payments-api' });
const PR: PullRequestState = {
  number: 318,
  title: 'Guard duplicate credits',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'queued',
  isAutoMerge: true,
  isDraft: false,
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-credit',
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-07T08:00:00Z',
};
let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    workspaces: [WORKSPACE],
    projects: [PROJECT],
    sessions: [SESSION],
    sessionActiveMount: { [SESSION.id]: MOUNT },
    sessionActiveProject: { [SESSION.id]: PROJECT.id },
    sessionProjectMounts: {
      [SESSION.id]: [
        {
          mountId: MOUNT,
          sessionId: SESSION.id,
          projectId: PROJECT.id,
          mountName: 'payments-api',
          worktreePath: '/worktrees/payments-api',
          lastWorktreePath: '/worktrees/payments-api',
          repoRoot: '/repos/payments-api',
          branch: PR.headBranch,
          baseBranch: 'main',
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
  });
});

type FactsParams = { readonly host?: PullRequestHost; readonly isAutoMerge?: boolean };
const factsOf = ({ host = 'github', isAutoMerge = true }: FactsParams = {}) =>
  pullRequestFacts({
    sessionId: SESSION.id,
    host,
    pr: { ...PR, isAutoMerge: isAutoMerge },
    checks: [],
    comments: [],
    reviews: [],
    viewer: null,
    writeInFlight: null,
    isScribeWriting: false,
  });
const ACTION = PULL_REQUEST_KIND.actions.find(
  (action) => action.id === 'pullRequest.cancelAutoMerge',
);

type RunParams = { readonly host?: PullRequestHost };
const run = async ({ host = 'github' }: RunParams = {}) => {
  if (ACTION === undefined) {
    throw new Error('Missing cancel auto-merge');
  }
  const env: ActionEnv = {
    getState: store.getState,
    showToast: vi.fn(),
    copyText: async () => undefined,
    origin: 'overflow',
    anchorKey: null,
    viewing: null,
  };
  await ACTION.run({ facts: factsOf({ host }), env, choice: null });
};

describe('cancel auto-merge', () => {
  it.each(['github', 'gitlab', 'bitbucket'] as const)(
    'appears only with auto-merge and the %s capability',
    (host) => {
      const visible = resolveActions({
        definitions: PULL_REQUEST_KIND.actions,
        facts: factsOf({ host }),
      }).find((action) => action.id === 'pullRequest.cancelAutoMerge');
      expect(visible?.label ?? null).toBe(host === 'bitbucket' ? null : 'Cancel auto-merge');
      expect(
        resolveActions({
          definitions: PULL_REQUEST_KIND.actions,
          facts: factsOf({ host, isAutoMerge: false }),
        }).some((action) => action.id === 'pullRequest.cancelAutoMerge'),
      ).toBe(false);
      if (visible !== undefined) {
        expect(visible.slot).toBe('menu');
      }
    },
  );

  it('refreshes the captured mount only after cancellation succeeds', async () => {
    let finish: (() => void) | undefined;
    stubStoryInvoke({
      gh_run: () =>
        new Promise((resolve) => {
          finish = () => resolve({ stdout: '', stderr: '', exitCode: 0 });
        }),
    });
    const refresh = vi.fn(async () => undefined);
    const load = vi.fn(async () => undefined);
    store.setState({ refreshSessionPr: refresh, loadPullRequestView: load });
    const pending = run();
    expect(refresh).not.toHaveBeenCalled();
    store.setState({
      sessionActiveMount: { [SESSION.id]: mountOf({ name: 'mount-ledger-core' }) },
    });
    if (finish === undefined) {
      throw new Error('Cancellation did not reach GitHub');
    }
    finish();
    await pending;
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith(
      'gh_run',
      expect.objectContaining({
        args: ['pr', 'merge', '318', '--disable-auto'],
        cwd: '/repos/payments-api',
        projectId: PROJECT.id,
      }),
    );
    expect(refresh).toHaveBeenCalledWith(SESSION.id, { force: true, mountId: MOUNT });
    expect(load).toHaveBeenCalledWith({ sessionId: SESSION.id, mountId: MOUNT, force: true });
  });

  it('keeps state on failure and lets the same action retry', async () => {
    stubStoryInvoke({ gh_run: { stdout: '', stderr: 'HTTP 403: denied', exitCode: 1 } });
    const refresh = vi.fn(async () => undefined);
    store.setState({
      refreshSessionPr: refresh,
      loadPullRequestView: vi.fn(async () => undefined),
    });
    await expect(run()).rejects.toMatchObject({ kind: 'failed' });
    expect(refresh).not.toHaveBeenCalled();
    stubStoryInvoke({ gh_run: { stdout: '', stderr: '', exitCode: 0 } });
    await run();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
