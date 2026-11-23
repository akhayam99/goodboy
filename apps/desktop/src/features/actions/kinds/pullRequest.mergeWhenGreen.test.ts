import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { MountId, PullRequestHost, PullRequestState } from '@goodboy/types';
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

vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

const WORKSPACE = aWorkspace();
const PROJECT = aProject({ workspaceId: WORKSPACE.id, name: 'notify-relay' });
const SESSION = aSession({ workspaceId: WORKSPACE.id });
const mountOf = ({ name }: { readonly name: string }): MountId => JSON.parse(JSON.stringify(name));
const MOUNT = mountOf({ name: 'mount-notify-relay' });
const HEAD = 'abcdef1234';
const PR: PullRequestState = {
  number: 76,
  title: 'Retry budget for webhooks',
  url: 'https://github.com/acme/notify-relay/pull/76',
  state: 'open',
  isAutoMerge: false,
  isDraft: false,
  mergeable: true,
  checks: 'pending',
  baseBranch: 'main',
  headBranch: 'acme/retry-budget',
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-11-20T08:00:00Z',
  headSha: HEAD,
};
const ACTION_ID = 'pullRequest.mergeWhenGreen';
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
          mountName: 'notify-relay',
          worktreePath: '/worktrees/notify-relay',
          lastWorktreePath: '/worktrees/notify-relay',
          repoRoot: '/repos/notify-relay',
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

type FactsParams = {
  readonly host?: PullRequestHost;
  readonly pr?: Partial<PullRequestState>;
};

const factsOf = ({ host = 'github', pr = {} }: FactsParams = {}) =>
  pullRequestFacts({
    sessionId: SESSION.id,
    host,
    pr: { ...PR, ...pr },
    checks: [
      {
        name: 'ci',
        conclusion: pr.checks === 'success' ? 'success' : 'pending',
        detailsUrl: null,
        durationMs: null,
      },
    ],
    comments: [],
    reviews: [],
    viewer: null,
    writeInFlight: null,
    isScribeWriting: false,
  });

const visibleOf = ({ host, pr }: FactsParams = {}) =>
  resolveActions({
    definitions: PULL_REQUEST_KIND.actions,
    facts: factsOf({ host, pr }),
  }).find((action) => action.id === ACTION_ID);

const ACTION = PULL_REQUEST_KIND.actions.find((action) => action.id === ACTION_ID);

type RunParams = { readonly choice?: string | null };

const run = async ({ choice = null }: RunParams = {}) => {
  if (ACTION === undefined) {
    throw new Error('Missing merge when green');
  }
  const env: ActionEnv = {
    getState: store.getState,
    showToast: vi.fn(),
    copyText: async () => undefined,
    origin: 'overflow',
    anchorKey: null,
    viewing: null,
  };
  await ACTION.run({ facts: factsOf(), env, choice });
};

describe('merge when green', () => {
  it.each(['github', 'gitlab', 'bitbucket'] as const)(
    'appears while checks run only where %s runs it',
    (host) => {
      expect(visibleOf({ host })?.label ?? null).toBe(
        host === 'github' ? 'Merge when green' : null,
      );
    },
  );

  it('stays away once checks are green, auto-merge is on or the request is a draft', () => {
    expect(visibleOf({ pr: { checks: 'success' } })).toBeUndefined();
    expect(visibleOf({ pr: { isAutoMerge: true } })).toBeUndefined();
    expect(visibleOf({ pr: { isDraft: true, state: 'draft' } })).toBeUndefined();
  });

  it('is blocked by changes requested, never by the running checks', () => {
    expect(visibleOf()?.blockedReason ?? null).toBeNull();
    expect(visibleOf({ pr: { reviewDecision: 'changes_requested' } })?.blockedReason).toBe(
      'A reviewer asked for changes.',
    );
  });

  it('asks the host to merge the reviewed head with the method you chose', async () => {
    stubStoryInvoke({ gh_run: { stdout: '', stderr: '', exitCode: 0 } });
    const refresh = vi.fn(async () => undefined);
    store.setState({
      refreshSessionPr: refresh,
      loadPullRequestView: vi.fn(async () => undefined),
    });
    await run({ choice: 'rebase' });
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith(
      'gh_run',
      expect.objectContaining({
        args: ['pr', 'merge', '76', '--auto', '--rebase', '--match-head-commit', HEAD],
        cwd: '/repos/notify-relay',
      }),
    );
    expect(refresh).toHaveBeenCalledWith(SESSION.id, { force: true, mountId: MOUNT });
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

  it('is undone by cancel auto-merge once the host holds it', () => {
    const cancel = resolveActions({
      definitions: PULL_REQUEST_KIND.actions,
      facts: factsOf({ pr: { isAutoMerge: true, state: 'queued' } }),
    }).find((action) => action.id === 'pullRequest.cancelAutoMerge');
    expect(cancel?.label).toBe('Cancel auto-merge');
  });
});
