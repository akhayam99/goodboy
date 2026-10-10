// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionMountView, SessionProjectMount } from '@goodboy/types';
import { TEST_NOW, aProject } from '@goodboy/types/testing';
import { mountFixture } from '../../__tests__/helpers/actionFixtures';
import { selectExploreMount, type ExploreTarget } from './selectExploreMount';

const LEDGER_PROJECT = aProject({ name: 'ledger-core', rootPath: '/work/ledger-core' });
const NOTIFY_PROJECT = aProject({ name: 'notify-relay', rootPath: '/work/notify-relay' });
const PROJECTS = [LEDGER_PROJECT, NOTIFY_PROJECT];

const LEDGER = mountFixture({
  mountId: mountFixture().mountId,
  projectId: LEDGER_PROJECT.id,
  mountName: 'ledger-core',
  worktreePath: '/work/ledger-core-rounding',
  branch: 'hl/ledger-rounding',
});
const NOTIFY = mountFixture({
  mountId: mountFixture({ mountName: 'notify-relay' }).mountId,
  projectId: NOTIFY_PROJECT.id,
  mountName: 'notify-relay',
  worktreePath: '/work/notify-relay-retries',
  branch: 'hl/notify-retries',
  parallelIndex: 1,
});

const viewOf = (
  mount: SessionProjectMount,
  overrides: Partial<SessionMountView> = {},
): SessionMountView => ({
  id: mount.mountId,
  sessionId: mount.sessionId,
  projectId: mount.projectId,
  worktreePath: mount.worktreePath,
  lastWorktreePath: mount.lastWorktreePath,
  branch: mount.branch,
  baseBranch: mount.baseBranch,
  parallelIndex: mount.parallelIndex,
  mountName: mount.mountName,
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  repoRoot: mount.repoRoot,
  ...overrides,
});

type Case = {
  readonly name: string;
  readonly requestedPath: string | null;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly views?: ReadonlyArray<SessionMountView>;
  readonly fallback: SessionProjectMount | null;
  readonly isFirstLap?: boolean;
  readonly scratchPath?: string | null;
  readonly expected: ExploreTarget;
};

const LEDGER_TARGET: ExploreTarget = {
  kind: 'mount',
  path: LEDGER.worktreePath,
  projectName: 'ledger-core',
  branch: 'hl/ledger-rounding',
};
const NOTIFY_TARGET: ExploreTarget = {
  kind: 'mount',
  path: NOTIFY.worktreePath,
  projectName: 'notify-relay',
  branch: 'hl/notify-retries',
};

const CASES: ReadonlyArray<Case> = [
  {
    name: 'follows the write destination when nothing was picked',
    requestedPath: null,
    mounts: [LEDGER, NOTIFY],
    fallback: LEDGER,
    expected: LEDGER_TARGET,
  },
  {
    name: 'shows the requested project while it is still mounted',
    requestedPath: NOTIFY.worktreePath,
    mounts: [LEDGER, NOTIFY],
    fallback: LEDGER,
    expected: NOTIFY_TARGET,
  },
  {
    name: 'ignores an empty request',
    requestedPath: '',
    mounts: [LEDGER, NOTIFY],
    fallback: LEDGER,
    expected: LEDGER_TARGET,
  },
  {
    name: 'falls back to the write destination for a path nobody knows',
    requestedPath: '/work/elsewhere',
    mounts: [LEDGER, NOTIFY],
    fallback: LEDGER,
    expected: LEDGER_TARGET,
  },
  {
    name: 'says the worktree is gone when the requested one lost its files',
    requestedPath: NOTIFY.worktreePath,
    mounts: [LEDGER],
    views: [
      viewOf(LEDGER),
      viewOf(NOTIFY, {
        worktreePath: null,
        lastWorktreePath: NOTIFY.worktreePath,
        diskState: 'removed',
      }),
    ],
    fallback: LEDGER,
    expected: {
      kind: 'gone',
      path: NOTIFY.worktreePath,
      projectName: 'notify-relay',
      branch: 'hl/notify-retries',
    },
  },
  {
    name: 'matches a gone worktree by its current path too',
    requestedPath: NOTIFY.worktreePath,
    mounts: [LEDGER],
    views: [viewOf(LEDGER), viewOf(NOTIFY, { diskState: 'missing' })],
    fallback: LEDGER,
    expected: {
      kind: 'gone',
      path: NOTIFY.worktreePath,
      projectName: 'notify-relay',
      branch: 'hl/notify-retries',
    },
  },
  {
    name: 'shows the one mount of a session',
    requestedPath: null,
    mounts: [LEDGER],
    fallback: LEDGER,
    expected: LEDGER_TARGET,
  },
  {
    name: 'shows a folder project by its name alone',
    requestedPath: null,
    mounts: [{ ...LEDGER, branch: '' }],
    fallback: { ...LEDGER, branch: '' },
    expected: { ...LEDGER_TARGET, branch: '' },
  },
  {
    name: 'has nothing to show without a mount, a first lap or a scratch folder',
    requestedPath: null,
    mounts: [],
    fallback: null,
    scratchPath: null,
    expected: { kind: 'none' },
  },
  {
    name: 'has nothing to show for a mount without a folder',
    requestedPath: null,
    mounts: [{ ...LEDGER, worktreePath: '' }],
    fallback: { ...LEDGER, worktreePath: '' },
    expected: { kind: 'none' },
  },
  {
    name: 'shows the project folder during the first lap',
    requestedPath: null,
    mounts: [],
    fallback: null,
    isFirstLap: true,
    expected: { kind: 'root', path: '/work/ledger-core', projectName: 'ledger-core' },
  },
  {
    name: 'shows the scratch folder of a session without a project',
    requestedPath: null,
    mounts: [],
    fallback: null,
    scratchPath: '/scratch/session-harborline',
    expected: { kind: 'scratch', path: '/scratch/session-harborline' },
  },
  {
    name: 'prefers a mount over the first lap folder',
    requestedPath: null,
    mounts: [NOTIFY],
    fallback: NOTIFY,
    isFirstLap: true,
    expected: NOTIFY_TARGET,
  },
];

describe('selectExploreMount', () => {
  it.each(CASES)('$name', (scenario) => {
    expect(
      selectExploreMount({
        requestedPath: scenario.requestedPath,
        mounts: scenario.mounts,
        views: scenario.views ?? scenario.mounts.map((mount) => viewOf(mount)),
        fallback: scenario.fallback,
        projects: PROJECTS,
        firstLapProject: scenario.isFirstLap === true ? LEDGER_PROJECT : null,
        scratchPath: scenario.scratchPath ?? null,
      }),
    ).toEqual(scenario.expected);
  });
});
