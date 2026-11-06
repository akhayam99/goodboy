// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../worktree/worktree', async () =>
  (await import('../../../../../store/storyHarness')).worktreeModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  brandId,
  type Agent,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionProjectMount,
  type WorktreeStatus,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { AgentDockChanges } from './index';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const OWN_MOUNT = brandId<MountId>({ value: 'mount-payments-api' });
const OTHER_MOUNT = brandId<MountId>({ value: 'mount-notify-relay' });
const OWN_PATH = '/work/payments-api';
const OTHER_PATH = '/work/notify-relay';

const mountOf = (mountId: MountId, worktreePath: string, name: string): SessionProjectMount => ({
  mountId,
  sessionId: SESSION,
  projectId: brandId<ProjectId>({ value: `project-${name}` }),
  mountName: name,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: worktreePath,
  branch: `ak/${name}`,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const dirty = (changed: number): WorktreeStatus => ({
  branch: null,
  head: null,
  headSubject: null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: changed, untracked: 0, unmerged: 0, changed },
  upstream: null,
  inProgress: null,
});

const clean = (): WorktreeStatus => dirty(0);

let useAppStore: StoryStore;
let seedStatus: Awaited<ReturnType<typeof storySpies.worktreeStatus>>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  useAppStore.setState({
    sessionProjectMounts: {
      [SESSION]: [
        mountOf(OTHER_MOUNT, OTHER_PATH, 'notify-relay'),
        mountOf(OWN_MOUNT, OWN_PATH, 'payments-api'),
      ],
    },
  });
  seedStatus = await storySpies.worktreeStatus(OWN_PATH);
  storySpies.worktreeStatus.mockImplementation(async (path: string) =>
    Object.assign({}, seedStatus, path === OTHER_PATH ? dirty(7) : dirty(2)),
  );
  storySpies.worktreeStatus.mockClear();
});

afterEach(() => {
  cleanup();
  resetWorktreeStatusCache();
});

const renderChanges = ({ agent }: { readonly agent: Agent }) =>
  render(<AgentDockChanges sessionId={SESSION} agent={agent} />);

describe('AgentDockChanges', () => {
  it('offers Review changes for the project the agent works in', async () => {
    renderChanges({
      agent: anAgent({ sessionId: SESSION, kind: 'implementer', mountId: OWN_MOUNT }),
    });

    await screen.findByText('2 files changed on ak/payments-api');
    screen.getByRole('button', { name: 'Review changes' });
  });

  it('offers nothing to an agent with no project, never another one first in the list', async () => {
    renderChanges({ agent: anAgent({ sessionId: SESSION, kind: 'implementer' }) });

    await waitFor(() => expect(storySpies.worktreeStatus).not.toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
    expect(screen.queryByText(/files changed/)).toBeNull();
  });

  it('offers nothing to an agent that only reads, even on a dirty project', async () => {
    renderChanges({ agent: anAgent({ sessionId: SESSION, kind: 'planner', mountId: OWN_MOUNT }) });

    await waitFor(() => expect(storySpies.worktreeStatus).not.toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
  });

  it('offers nothing when the project has no change to review', async () => {
    storySpies.worktreeStatus.mockImplementation(async () =>
      Object.assign({}, seedStatus, clean()),
    );
    renderChanges({
      agent: anAgent({ sessionId: SESSION, kind: 'implementer', mountId: OWN_MOUNT }),
    });

    await waitFor(() => expect(storySpies.worktreeStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
  });
});
