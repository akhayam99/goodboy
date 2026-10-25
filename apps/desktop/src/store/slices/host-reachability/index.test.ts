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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionMountView,
} from '@goodboy/types';
import type { MountGitlabMrState } from '../gitlab-mr/state';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { CommandError } from '../../../shared/lib/invokeCommand';
import type { HostFailureKind } from '../../../shared/lib/hostFailure';
import { refreshMountRequest } from '../project-mounts/refreshMountRequest';
import { isHostAskDue } from './isHostAskDue';
import { reachabilityAfter } from './reachabilityAfter';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 24, 10, 42, 0);
const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-1' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

const STAMP = brandId<IsoDateTime>({ value: '2026-10-24T10:00:00.000Z' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-1' });

type MountParams = {
  readonly id: MountId;
};

const buildMountView = ({ id }: MountParams): SessionMountView => ({
  id,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  repoRoot: '/code/harborline/payments-api',
  worktreePath: null,
  lastWorktreePath: null,
  branch: 'ak/ledger-fix',
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: STAMP,
  updatedAt: STAMP,
});

const buildGitlabEntry = ({ id }: MountParams): MountGitlabMrState => ({
  mountId: id,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'gitlab.example.test',
  projectPath: 'harborline/payments-api',
  branch: 'ak/ledger-fix',
  mrs: [],
  links: [],
  mr: null,
  fetchedAt: null,
  loading: false,
  error: null,
});

const failureOf = ({ kind }: { readonly kind: HostFailureKind }): CommandError =>
  new CommandError({
    kind: 'host',
    message: 'request failed',
    failure: { kind, status: null, retryAfterSeconds: null, detail: null },
  });

describe('the reachability of a host', () => {
  it('turns a network or timeout answer into one outage that keeps its first time', () => {
    const first = reachabilityAfter({ previous: undefined, answer: 'network', now: T0 });
    const second = reachabilityAfter({ previous: first, answer: 'timeout', now: T0 + MIN });

    expect(first).toEqual({
      status: 'unreachable',
      since: T0,
      failures: 1,
      lastFailureAt: T0,
      reason: 'network',
    });
    expect(second).toEqual({
      status: 'unreachable',
      since: T0,
      failures: 2,
      lastFailureAt: T0 + MIN,
      reason: 'timeout',
    });
  });

  it('counts every other answer as the host being there', () => {
    const down = reachabilityAfter({ previous: undefined, answer: 'network', now: T0 });

    for (const answer of ['ok', 'bad_credentials', 'denied', 'rate_limited', 'failed'] as const) {
      expect(reachabilityAfter({ previous: down, answer, now: T0 + MIN })).toEqual({
        status: 'recovered',
        at: T0 + MIN,
      });
      expect(reachabilityAfter({ previous: undefined, answer, now: T0 })).toBeUndefined();
    }
  });

  it('asks on every poll for the first two failures, then at most once in five minutes', () => {
    const entry = (failures: number) =>
      ({
        status: 'unreachable',
        since: T0,
        failures,
        lastFailureAt: T0,
        reason: 'network',
      }) as const;

    expect(isHostAskDue({ entry: entry(2), now: T0 + 1_000 })).toBe(true);
    expect(isHostAskDue({ entry: entry(3), now: T0 + 4 * MIN })).toBe(false);
    expect(isHostAskDue({ entry: entry(3), now: T0 + 5 * MIN })).toBe(true);
    expect(isHostAskDue({ entry: undefined, now: T0 })).toBe(true);
  });
});

describe('noteHostAnswer', () => {
  it('drops an answer to a question asked before the one already counted', () => {
    const { noteHostAnswer } = useAppStore.getState();

    noteHostAnswer({ host: 'gitlab', answer: 'ok', askedAt: T0 + 2 });
    noteHostAnswer({ host: 'gitlab', answer: 'network', askedAt: T0 + 1 });

    expect(useAppStore.getState().hostReachability.gitlab).toBeUndefined();
  });

  it('keeps one host out of the way of another', () => {
    const { noteHostAnswer } = useAppStore.getState();

    noteHostAnswer({ host: 'gitlab', answer: 'network', askedAt: T0 });

    expect(useAppStore.getState().hostReachability.gitlab?.status).toBe('unreachable');
    expect(useAppStore.getState().hostReachability.bitbucket).toBeUndefined();
  });

  it('shows the host as reachable again once, then lets the line go', () => {
    const { noteHostAnswer, dismissRecoveredHost } = useAppStore.getState();
    noteHostAnswer({ host: 'gitlab', answer: 'network', askedAt: T0 });

    noteHostAnswer({ host: 'gitlab', answer: 'ok', askedAt: T0 + 1 });
    expect(useAppStore.getState().hostReachability.gitlab).toEqual({ status: 'recovered', at: T0 });

    dismissRecoveredHost({ host: 'gitlab' });
    expect(useAppStore.getState().hostReachability.gitlab).toBeUndefined();
  });

  it('does not dismiss an outage that is still on', () => {
    useAppStore.getState().noteHostAnswer({ host: 'gitlab', answer: 'network', askedAt: T0 });

    useAppStore.getState().dismissRecoveredHost({ host: 'gitlab' });

    expect(useAppStore.getState().hostReachability.gitlab?.status).toBe('unreachable');
  });
});

describe('a poller that asks the host', () => {
  type Context = { readonly isReady: boolean };

  type RunParams = {
    readonly load: () => Promise<{ readonly kind: 'settle'; readonly next: () => null }>;
    readonly isSilent?: boolean;
    readonly isForced?: boolean;
  };

  const answered = () => Promise.resolve({ kind: 'settle', next: () => null } as const);
  const network = () => Promise.reject(failureOf({ kind: 'network' }));
  const denied = () => Promise.reject(failureOf({ kind: 'denied' }));
  const plain = () => Promise.reject(new Error('database is locked'));

  const run = async ({ load, isSilent = true, isForced = false }: RunParams): Promise<void> => {
    await refreshMountRequest<MountGitlabMrState, Context>({
      set: (patch) => useAppStore.setState(patch),
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      mount: { id: MOUNT_ID, revision: 0 },
      host: 'gitlab',
      opts: { silent: isSilent, force: isForced },
      adapter: {
        read: () => buildGitlabEntry({ id: MOUNT_ID }),
        apply: () => ({}),
        resolveContext: () => ({ isReady: true }),
        pendingEntry: () => buildGitlabEntry({ id: MOUNT_ID }),
        load,
        failedEntry: ({ current }) => current,
      },
    });
  };

  const advance = ({ ms }: { readonly ms: number }) => vi.setSystemTime(Date.now() + ms);

  it('pauses after three unreachable answers and asks again after five minutes', async () => {
    const load = vi.fn(network);
    for (let ask = 0; ask < 3; ask += 1) {
      await run({ load });
      advance({ ms: MIN });
    }
    expect(useAppStore.getState().hostReachability.gitlab).toMatchObject({
      status: 'unreachable',
      since: T0,
      failures: 3,
    });
    expect(load).toHaveBeenCalledTimes(3);

    await run({ load });
    expect(load).toHaveBeenCalledTimes(3);

    advance({ ms: 4 * MIN });
    await run({ load });
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('is never held back when the person asked, by force or from a screen', async () => {
    const load = vi.fn(network);
    for (let ask = 0; ask < 3; ask += 1) {
      await run({ load });
    }

    await run({ load, isForced: true });
    await run({ load, isSilent: false });

    expect(load).toHaveBeenCalledTimes(5);
  });

  it('turns an answer after an outage into reachable again', async () => {
    await run({ load: network });

    await run({ load: answered });

    expect(useAppStore.getState().hostReachability.gitlab).toMatchObject({ status: 'recovered' });
  });

  it('counts a refused sign-in as the host being there', async () => {
    await run({ load: network });
    advance({ ms: 1 });

    await run({ load: denied });

    expect(useAppStore.getState().hostReachability.gitlab).toMatchObject({ status: 'recovered' });
  });

  it('leaves an untyped failure out of the count', async () => {
    await run({ load: plain });

    expect(useAppStore.getState().hostReachability.gitlab).toBeUndefined();
  });
});

describe('Retry on a host', () => {
  it('asks again for every session that already holds a request of that host', async () => {
    const refreshSessionMr = vi.fn(async () => undefined);
    const refreshSessionBitbucketPr = vi.fn(async () => undefined);
    useAppStore.setState({
      refreshSessionMr,
      refreshSessionBitbucketPr,
      sessionMounts: {
        [SESSION_ID]: [buildMountView({ id: MOUNT_ID })],
        'session-2': [buildMountView({ id: brandId<MountId>({ value: 'mount-2' }) })],
      },
      mountGitlabMr: { [MOUNT_ID]: buildGitlabEntry({ id: MOUNT_ID }) },
    });

    await useAppStore.getState().retryHost({ host: 'gitlab' });

    expect(refreshSessionMr).toHaveBeenCalledOnce();
    expect(refreshSessionMr).toHaveBeenCalledWith(SESSION_ID, { force: true, silent: true });
    expect(refreshSessionBitbucketPr).not.toHaveBeenCalled();
  });

  it('lets the line go when nothing is waiting on that host any more', async () => {
    useAppStore.getState().noteHostAnswer({ host: 'bitbucket', answer: 'network', askedAt: T0 });

    await useAppStore.getState().retryHost({ host: 'bitbucket' });

    expect(useAppStore.getState().hostReachability.bitbucket).toBeUndefined();
  });
});
