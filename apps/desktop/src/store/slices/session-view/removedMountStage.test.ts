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
import { cleanup } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import {
  brandId,
  type MountId,
  type MountPullRequestLink,
  type MountPullRequestProvider,
  type Session,
  type SessionMountView,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import {
  at,
  mergedGithub,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import {
  aView,
  FIXTURE_NOW,
  FIXTURE_ROOT,
  FIXTURE_SESSION,
} from '../../../features/auto/testing/autoViewFixtures';
import { stageInfoOf } from './stageInfoOf';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const DATE = at('2026-10-07T09:00:00.000Z');
const MERGED_AT = at(new Date(FIXTURE_NOW + 3_600_000).toISOString());
const REMOVED_ID = brandId<MountId>({ value: 'mount-removed' });
const LIVE_ID = brandId<MountId>({ value: 'mount-live' });

const session = (): Session => ({
  ...sessionOf({ goal: 'Retry webhooks' }),
  id: FIXTURE_SESSION,
});

type ViewParams = {
  readonly id: MountId;
  readonly isAttached: boolean;
};

const viewOf = ({ id, isAttached }: ViewParams): SessionMountView => ({
  id,
  sessionId: FIXTURE_SESSION,
  projectId: paymentsApi.id,
  worktreePath: isAttached ? `/tmp/payments-api/${id}` : null,
  lastWorktreePath: `/tmp/payments-api/${id}`,
  branch: `harborline/${id}`,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: null,
  repoRoot: '/tmp/payments-api',
  isAttached,
  diskState: isAttached ? 'present' : 'removed',
  revision: 1,
  createdAt: DATE,
  updatedAt: DATE,
});

type LinkParams = {
  readonly provider: MountPullRequestProvider;
  readonly state: MountPullRequestLink['state'];
};

const linkOf = ({ provider, state }: LinkParams): MountPullRequestLink => ({
  id: 'link-removed',
  mountId: REMOVED_ID,
  provider,
  host: provider === 'github' ? 'github.com' : `${provider}.example.test`,
  repoSlug: 'harborline/payments-api',
  prNumber: 41,
  headBranch: 'harborline/mount-removed',
  baseBranch: 'main',
  url: 'https://example.test/pull/41',
  state,
  snapshot: null,
  mergedAt: state === 'merged' ? MERGED_AT : null,
  lastObservedAt: DATE,
  createdAt: DATE,
  updatedAt: DATE,
});

type SeedParams = LinkParams & {
  readonly isLiveMountAdded?: boolean;
  readonly isFailedTreeSeeded?: boolean;
};

const seed = ({
  provider,
  state,
  isLiveMountAdded = false,
  isFailedTreeSeeded = false,
}: SeedParams): Session => {
  const seeded = session();
  seedColumn({ store: useAppStore, sessions: [seeded], currentSessionId: seeded.id });
  const views = [
    viewOf({ id: REMOVED_ID, isAttached: false }),
    ...(isLiveMountAdded ? [viewOf({ id: LIVE_ID, isAttached: true })] : []),
  ];
  const github = mergedGithub();
  useAppStore.setState({
    sessionMounts: { [seeded.id]: views },
    sessionProjectMounts: {},
    sessionBranches: {},
    sessionGithub: {},
    mountGithub: isLiveMountAdded
      ? {
          [LIVE_ID]: {
            ...github,
            mountId: LIVE_ID,
            projectId: paymentsApi.id,
            revision: 1,
            repository: 'harborline/payments-api',
            host: 'github.com',
            branch: 'harborline/mount-live',
            links: [],
            pr: github.pr === null ? null : { ...github.pr, state: 'open', number: 52 },
            prs: [],
          },
        }
      : {},
    mountPrLinks: { [REMOVED_ID]: linkOf({ provider, state }) },
    ...(isFailedTreeSeeded
      ? {
          sessionPhaseRuns: {
            [seeded.id]: [anAgent({ id: FIXTURE_ROOT, sessionId: seeded.id, kind: 'auto' })],
          },
          autoTreeViews: { [seeded.id]: [aView({ phase: 'blocked' })] },
          autoClockAt: FIXTURE_NOW,
        }
      : {}),
  });
  return seeded;
};

const infoOf = (target: Session) => stageInfoOf(useAppStore.getState(), target);

describe('a session whose branch was deleted after its merge', () => {
  it.each([
    ['github', 'PR #41 merged'],
    ['gitlab', 'MR !41 merged'],
    ['bitbucket', 'PR #41 merged'],
  ] as const)('is done on the merged %s request', (provider, reason) => {
    const info = infoOf(seed({ provider, state: 'merged' }));

    expect(info.stage).toBe('done');
    expect(info.reason).toBe(reason);
  });

  it.each(['github', 'gitlab', 'bitbucket'] as const)(
    'stays open when the %s request was closed without a merge',
    (provider) => {
      expect(infoOf(seed({ provider, state: 'closed' })).stage).not.toBe('done');
    },
  );

  it('stays open while a second live branch holds an open request', () => {
    const info = infoOf(seed({ provider: 'github', state: 'merged', isLiveMountAdded: true }));

    expect(info.stage).toBe('review');
    expect(info.reason).toContain('PR #52');
  });

  it('drops a failure that predates the merge and lets the session be done', () => {
    const info = infoOf(seed({ provider: 'github', state: 'merged', isFailedTreeSeeded: true }));

    expect(info.attention).toBeNull();
    expect(info.stage).toBe('done');
  });

  it('keeps a failure while the session has no merge', () => {
    const info = infoOf(seed({ provider: 'github', state: 'closed', isFailedTreeSeeded: true }));

    expect(info.attention).toBe('agent-error');
  });
});
