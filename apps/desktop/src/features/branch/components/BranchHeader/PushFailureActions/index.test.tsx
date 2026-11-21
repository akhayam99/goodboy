// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  FIX_RUN_MOUNT,
  MOUNT_TARGET,
  SESSION,
  seedResolveScene,
} from '../../../../../app/components/MockScene/scenes/resolveSeed';
import type { PushFixOutcome } from '../../../../../store/slices/history/types';
import { PushFailureActions } from './index';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const AGENT_ID = brandId<AgentId>({ value: 'agent-header-fixer' });

const READY = {
  state: 'ready',
  command: 'pnpm install --frozen-lockfile',
  source: 'pnpm-lock.yaml',
  folder: 'node_modules',
  isFolderLink: false,
  outside: [],
};

type Check = { readonly state: string };

const world: { check: Check } = { check: { ...READY } };

beforeEach(async () => {
  world.check = { ...READY };
  await resetStoryStore();
  stubStoryInvoke({ worktree_deps_check: () => world.check });
  seedResolveScene({ expandedThreadId: null });
  store.setState({ sessionProjectMounts: { [SESSION.id]: [FIX_RUN_MOUNT] } });
});

afterEach(cleanup);

type SeedAgentParams = {
  readonly status: 'running' | 'completed' | 'failed';
};

const seedFixAgent = ({ status }: SeedAgentParams): void => {
  const current = store.getState().sessionPhaseRuns[SESSION.id] ?? [];
  store.setState({
    sessionPhaseRuns: {
      ...store.getState().sessionPhaseRuns,
      [SESSION.id]: [
        ...current.filter((agent) => agent.id !== AGENT_ID),
        {
          id: AGENT_ID,
          sessionId: SESSION.id,
          ordinal: 9,
          name: 'Fix the push',
          status,
          mountId: MOUNT_TARGET.mountId,
        },
      ],
    },
  });
};

const outcome = (overrides: Partial<PushFixOutcome>): PushFixOutcome => ({
  agentId: AGENT_ID,
  sessionId: SESSION.id,
  mountId: MOUNT_TARGET.mountId,
  kind: 'pushed',
  reason: null,
  settledAt: 2,
  isClaimed: false,
  followUp: null,
  ...overrides,
});

type Handlers = {
  readonly onResolved?: () => void;
};

const actions = ({ onResolved = vi.fn() }: Handlers = {}) => (
  <PushFailureActions
    sessionId={SESSION.id}
    mountId={MOUNT_TARGET.mountId}
    isForce={false}
    confirmedOnlyOnline={null}
    confirmedRemoteSha={null}
    message="husky - pre-push script failed"
    onResolved={onResolved}
  />
);

const MOVED_ORIGIN = {
  remoteSha: 'newer-sha',
  knownRemoteSha: 'newer-sha',
  commits: [],
  onlyOnline: [{ sha: 'late-commit-sha', subject: 'Add the Harborline export', author: 'Acme' }],
  fetchError: null,
};

const movedActions = ({ onResolved = vi.fn() }: Handlers = {}) => (
  <PushFailureActions
    sessionId={SESSION.id}
    mountId={MOUNT_TARGET.mountId}
    isForce
    confirmedOnlyOnline={['early-commit']}
    confirmedRemoteSha="remote-sha"
    isOriginMoved
    message="Origin changed. Check again before force pushing."
    onResolved={onResolved}
  />
);

type LeaseArgs = {
  readonly expectedRemoteSha: string;
};

type OriginStubParams = {
  readonly origins: ReadonlyArray<typeof MOVED_ORIGIN>;
  readonly leases?: Array<LeaseArgs>;
};

const stubOrigin = ({ origins, leases = [] }: OriginStubParams) => {
  let read = 0;
  stubStoryInvoke({
    worktree_deps_check: () => world.check,
    history_origin_ahead: () => {
      const origin = origins[Math.min(read, origins.length - 1)];
      read += 1;
      return origin;
    },
    git_push_with_lease: (args: LeaseArgs) => {
      leases.push(args);
      return { kind: 'pushed' };
    },
  });
};

const checkAgain = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
  });
};

describe('PushFailureActions after origin moved', () => {
  beforeEach(() => {
    store.setState({
      projects: [
        aProject({
          id: FIX_RUN_MOUNT.projectId,
          workspaceId: SESSION.workspaceId,
          name: 'payments-api',
        }),
      ],
    });
  });

  it('offers Check again first and keeps the agent and the terminal', () => {
    render(movedActions());

    screen.getByRole('button', { name: 'Check again' });
    screen.getByRole('button', { name: 'Fix with an agent' });
    screen.getByRole('button', { name: 'Open in Terminal' });
  });

  it('lists what is new on origin with author and subject and asks again', async () => {
    stubOrigin({ origins: [MOVED_ORIGIN] });
    render(movedActions());

    await checkAgain();

    const list = await screen.findByRole('list', { name: 'New on origin' });
    expect(list.textContent).toContain('Add the Harborline export');
    expect(list.textContent).toContain('Acme');
    screen.getByText(
      'Origin has 1 commit this branch lacks. Force push drops them, a rebase keeps them.',
    );
    screen.getByRole('button', { name: 'Force push anyway' });
    screen.getByRole('button', { name: 'Rebase on their commits' });
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
  });

  it('force pushes with the sha it just checked', async () => {
    const onResolved = vi.fn();
    const leases: Array<LeaseArgs> = [];
    stubOrigin({ origins: [MOVED_ORIGIN], leases });
    store.setState({ refreshSessionPr: vi.fn(async () => undefined) });
    render(movedActions({ onResolved }));
    await checkAgain();

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Force push anyway' }));
    });

    await vi.waitFor(() => expect(onResolved).toHaveBeenCalledOnce());
    expect(leases).toEqual([expect.objectContaining({ expectedRemoteSha: 'newer-sha' })]);
  });

  it('goes back to Check again when another window pushed after the check', async () => {
    const leases: Array<LeaseArgs> = [];
    stubOrigin({
      origins: [
        MOVED_ORIGIN,
        { ...MOVED_ORIGIN, knownRemoteSha: 'newest-sha', remoteSha: 'newest-sha' },
      ],
      leases,
    });
    render(movedActions());
    await checkAgain();

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Force push anyway' }));
    });

    await screen.findByRole('button', { name: 'Check again' });
    screen.getByText('Origin changed. Check again before force pushing.');
    expect(leases).toEqual([]);
  });

  it('opens the terminal on fresh state after origin moved', async () => {
    stubOrigin({ origins: [MOVED_ORIGIN] });
    render(movedActions());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open in Terminal' }));
    });

    const prefills = Object.values(store.getState().terminalTabs)
      .flat()
      .map((tab) => tab.prefill);
    expect(prefills).toContain(
      `git rebase 'newer-sha' && git push origin '${FIX_RUN_MOUNT.branch}'`,
    );
  });

  it('starts the agent on fresh state after origin moved', async () => {
    const fixBranchPushWithAgent = vi.fn(async (_input: unknown) => undefined);
    store.setState({ fixBranchPushWithAgent });
    render(movedActions());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fix with an agent' }));
    });

    expect(fixBranchPushWithAgent).toHaveBeenCalledWith(
      expect.objectContaining({ isOriginMoved: true }),
    );
  });
});

describe('PushFailureActions', () => {
  it('offers the agent and the terminal while no fix runs', async () => {
    render(actions());

    screen.getByRole('button', { name: 'Fix with an agent' });
    screen.getByRole('button', { name: 'Open in Terminal' });
  });

  it('offers nothing while the fix agent works, after the failure line was left and came back', () => {
    seedFixAgent({ status: 'running' });

    const first = render(actions());
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    first.unmount();
    render(actions());

    expect(screen.queryByRole('button', { name: 'Fix with an agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open in Terminal' })).toBeNull();
  });

  it('offers Retry after the agent failed or you stopped it', () => {
    seedFixAgent({ status: 'failed' });
    store.setState({
      pushFixOutcomes: {
        [MOUNT_TARGET.mountId]: outcome({
          kind: 'agent_failed',
          reason: 'The provider is offline.',
        }),
      },
    });

    const failed = render(actions());

    screen.getByRole('button', { name: 'Retry' });
    screen.getByRole('button', { name: 'Open in Terminal' });
    expect(screen.queryByRole('button', { name: 'Fix with an agent' })).toBeNull();
    failed.unmount();

    store.setState({
      pushFixOutcomes: {
        [MOUNT_TARGET.mountId]: outcome({
          kind: 'agent_stopped',
          reason: 'The agent was stopped before it finished.',
        }),
      },
    });
    render(actions());

    screen.getByRole('button', { name: 'Retry' });
  });

  it('clears the failure once the fix pushed while the line was not on screen', () => {
    const onResolved = vi.fn();
    store.setState({ pushFixOutcomes: { [MOUNT_TARGET.mountId]: outcome({}) } });

    render(actions({ onResolved }));

    expect(onResolved).toHaveBeenCalledOnce();
  });

  it('leaves Reinstall dependencies to the stale dependencies notice above it', async () => {
    world.check = { ...READY, state: 'missing' };
    render(actions());

    await screen.findByRole('button', { name: 'Fix with an agent' });

    expect(screen.queryByRole('button', { name: 'Reinstall dependencies' })).toBeNull();
  });

  it('shows a failed start inline instead of in a toast', async () => {
    const reportError = vi.fn(async () => undefined);
    store.setState({ reportError });
    stubStoryInvoke({
      worktree_deps_check: () => world.check,
      history_origin_ahead: () => ({ ...MOVED_ORIGIN, fetchError: 'could not reach origin' }),
    });
    render(movedActions());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fix with an agent' }));
    });

    screen.getByText("Couldn't start the agent. could not reach origin");
    expect(reportError).not.toHaveBeenCalled();
  });

  it('starts the fix with the failure output', async () => {
    const fixBranchPushWithAgent = vi.fn(async (_input: unknown) => undefined);
    store.setState({ fixBranchPushWithAgent });
    render(actions());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fix with an agent' }));
    });

    expect(fixBranchPushWithAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION.id,
        mountId: MOUNT_TARGET.mountId,
        message: 'husky - pre-push script failed',
      }),
    );
  });
});
