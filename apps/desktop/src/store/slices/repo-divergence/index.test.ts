// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaseDivergence, Project, WorkspaceId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const PAYMENTS = aProject({
  workspaceId: WORKSPACE,
  name: 'payments-api',
  kind: 'repo',
  rootPath: '/work/payments-api',
  baseBranch: 'main',
});
const LEDGER = aProject({
  workspaceId: WORKSPACE,
  name: 'ledger-core',
  kind: 'repo',
  rootPath: '/work/ledger-core',
  baseBranch: 'main',
});

type ReportParams = {
  readonly state: BaseDivergence['state'];
  readonly ahead?: number;
  readonly behind?: number;
  readonly uncommitted?: number;
  readonly message?: string;
};

const reportOf = ({
  state,
  ahead = 0,
  behind = 0,
  uncommitted = 0,
  message,
}: ReportParams): BaseDivergence => ({
  state,
  base: 'main',
  upstream: 'origin/main',
  ahead,
  behind,
  checkoutBranch: 'main',
  uncommitted,
  message: message ?? null,
});

type DivergenceArgs = {
  readonly projectPath: string;
  readonly maxAgeMs: number;
};

type Deferred = {
  readonly promise: Promise<BaseDivergence>;
  readonly resolve: (report: BaseDivergence) => void;
};

const deferred = (): Deferred => {
  let resolve: (report: BaseDivergence) => void = () => undefined;
  const promise = new Promise<BaseDivergence>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const READY_STATUS = {
  state: 'ready',
  branch: 'main',
  headSubject: 'Bump the lockfile',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/main',
  inProgress: null,
};

const GIT_STUBS = { project_git_status: READY_STATUS, repo_identity: null };

const seed = (projects: ReadonlyArray<Project>): void => {
  useAppStore.setState({ projects, currentWorkspaceId: WORKSPACE });
};

const isDivergenceArgs = (args: unknown): args is DivergenceArgs =>
  typeof args === 'object' && args !== null && 'maxAgeMs' in args && 'projectPath' in args;

const divergenceCalls = (): ReadonlyArray<DivergenceArgs> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([command]) => command === 'repo_base_divergence')
    .flatMap(([, args]) => (isDivergenceArgs(args) ? [args] : []));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('checking the base branch of each workspace repo', () => {
  it('stores behind, diverged and up to date per repo, naming each repo and the freshness', async () => {
    seed([PAYMENTS, LEDGER]);
    stubStoryInvoke({
      ...GIT_STUBS,
      repo_base_divergence: ({ projectPath }: DivergenceArgs) =>
        projectPath === PAYMENTS.rootPath
          ? reportOf({ state: 'behind', behind: 3 })
          : reportOf({ state: 'diverged', ahead: 1, behind: 2 }),
    });

    const outcome = await useAppStore
      .getState()
      .checkRepoDivergence({ workspaceId: WORKSPACE, maxAgeMs: 270_000 });

    expect(outcome).toBe('checked');
    expect(useAppStore.getState().repoDivergence[PAYMENTS.id]?.behind).toBe(3);
    expect(useAppStore.getState().repoDivergence[LEDGER.id]?.state).toBe('diverged');
    expect(divergenceCalls()).toEqual([
      expect.objectContaining({ projectPath: PAYMENTS.rootPath, maxAgeMs: 270_000 }),
      expect.objectContaining({ projectPath: LEDGER.rootPath, maxAgeMs: 270_000 }),
    ]);
    expect(useAppStore.getState().repoCheckedAt[WORKSPACE]).toBeGreaterThan(0);
    expect(useAppStore.getState().repoCheckInFlight[WORKSPACE]).toBe(false);
  });

  it('never starts a second check while one is in flight', async () => {
    seed([PAYMENTS]);
    const pending = deferred();
    stubStoryInvoke({
      ...GIT_STUBS,
      repo_base_divergence: () => pending.promise,
    });

    const first = useAppStore
      .getState()
      .checkRepoDivergence({ workspaceId: WORKSPACE, maxAgeMs: 0 });
    const second = await useAppStore
      .getState()
      .checkRepoDivergence({ workspaceId: WORKSPACE, maxAgeMs: 0 });

    expect(second).toBe('skipped');
    expect(divergenceCalls()).toHaveLength(1);
    pending.resolve(reportOf({ state: 'up-to-date' }));
    expect(await first).toBe('checked');
    expect(useAppStore.getState().repoDivergence[PAYMENTS.id]?.state).toBe('up-to-date');
  });

  it('shows a failed fetch on the repo, and Retry asks git again with no cache', async () => {
    seed([PAYMENTS]);
    stubStoryInvoke({
      ...GIT_STUBS,
      repo_base_divergence: async () => {
        throw new Error('Could not resolve host: github.com');
      },
    });

    await useAppStore.getState().checkRepoDivergence({ workspaceId: WORKSPACE, maxAgeMs: 270_000 });

    const failed = useAppStore.getState().repoDivergence[PAYMENTS.id];
    expect(failed?.state).toBe('fetch-failed');
    expect(failed?.message).toContain('Could not resolve host');

    stubStoryInvoke({
      ...GIT_STUBS,
      repo_base_divergence: reportOf({ state: 'behind', behind: 2 }),
    });
    await useAppStore.getState().checkRepoDivergence({ workspaceId: WORKSPACE, maxAgeMs: 0 });

    expect(divergenceCalls().at(-1)?.maxAgeMs).toBe(0);
    expect(useAppStore.getState().repoDivergence[PAYMENTS.id]?.state).toBe('behind');
  });

  it('drops a late answer of an older check once a newer one landed', async () => {
    seed([PAYMENTS]);
    const old = deferred();
    let calls = 0;
    stubStoryInvoke({
      ...GIT_STUBS,
      checkout_update_base: { base: 'main', checkoutBranch: 'main', commitsPulled: 3 },
      repo_base_divergence: () => {
        calls += 1;
        return calls === 1 ? old.promise : Promise.resolve(reportOf({ state: 'up-to-date' }));
      },
    });

    const background = useAppStore
      .getState()
      .checkRepoDivergence({ workspaceId: WORKSPACE, maxAgeMs: 270_000 });
    await useAppStore
      .getState()
      .pullRepoBases({ workspaceId: WORKSPACE, projectIds: [PAYMENTS.id] });
    old.resolve(reportOf({ state: 'behind', behind: 3 }));
    await background;

    expect(useAppStore.getState().repoDivergence[PAYMENTS.id]?.state).toBe('up-to-date');
  });

  it('skips a workspace with no repo projects', async () => {
    seed([aProject({ workspaceId: WORKSPACE, name: 'notes', kind: 'folder' })]);

    const outcome = await useAppStore
      .getState()
      .checkRepoDivergence({ workspaceId: WORKSPACE, maxAgeMs: 0 });

    expect(outcome).toBe('skipped');
    expect(divergenceCalls()).toHaveLength(0);
  });
});

describe('pulling the base branch from the repositories entry', () => {
  it('fast-forwards the repo it names and reads the state again', async () => {
    seed([PAYMENTS, LEDGER]);
    useAppStore.setState({
      repoDivergence: { [PAYMENTS.id]: reportOf({ state: 'behind', behind: 3 }) },
    });
    stubStoryInvoke({
      ...GIT_STUBS,
      checkout_update_base: { base: 'main', checkoutBranch: 'main', commitsPulled: 3 },
      repo_base_divergence: reportOf({ state: 'up-to-date' }),
    });

    const outcomes = await useAppStore
      .getState()
      .pullRepoBases({ workspaceId: WORKSPACE, projectIds: [PAYMENTS.id] });

    expect(outcomes).toEqual([expect.objectContaining({ kind: 'updated', commits: 3 })]);
    const updates = storySpies.tauriInvoke.mock.calls.filter(
      ([command]) => command === 'checkout_update_base',
    );
    expect(updates).toEqual([
      [
        'checkout_update_base',
        expect.objectContaining({ checkoutPath: PAYMENTS.rootPath, baseBranch: 'main' }),
      ],
    ]);
    expect(useAppStore.getState().repoPull[PAYMENTS.id]).toBeUndefined();
    expect(useAppStore.getState().repoDivergence[PAYMENTS.id]?.state).toBe('up-to-date');
    expect(divergenceCalls().at(-1)?.maxAgeMs).toBe(0);
  });

  it('keeps the reason on the repo when git refuses a dirty checkout', async () => {
    seed([PAYMENTS]);
    const dirty = reportOf({ state: 'behind', behind: 3, uncommitted: 2 });
    stubStoryInvoke({
      ...GIT_STUBS,
      checkout_update_base: async () => {
        throw new Error('this checkout has uncommitted changes. commit or stash them first');
      },
      repo_base_divergence: dirty,
    });

    const outcomes = await useAppStore
      .getState()
      .pullRepoBases({ workspaceId: WORKSPACE, projectIds: [PAYMENTS.id] });

    expect(outcomes).toEqual([expect.objectContaining({ kind: 'skipped' })]);
    const pull = useAppStore.getState().repoPull[PAYMENTS.id];
    expect(pull?.kind === 'refused' ? pull.reason : null).toContain('uncommitted changes');
    expect(useAppStore.getState().repoDivergence[PAYMENTS.id]).toEqual(dirty);
  });
});
