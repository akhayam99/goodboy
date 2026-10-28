// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
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
  readonly onRetry?: () => void;
};

const actions = ({ onResolved = vi.fn(), onRetry = vi.fn() }: Handlers = {}) => (
  <PushFailureActions
    sessionId={SESSION.id}
    mountId={MOUNT_TARGET.mountId}
    isForce={false}
    confirmedOnlyOnline={null}
    confirmedRemoteSha={null}
    message="husky - pre-push script failed"
    onResolved={onResolved}
    onRetry={onRetry}
  />
);

describe('PushFailureActions', () => {
  it('offers the agent and the terminal while no fix runs', async () => {
    render(actions());

    await waitFor(() => expect(storySpies.tauriInvoke).toHaveBeenCalled());
    screen.getByRole('button', { name: 'Let an agent fix the push' });
    screen.getByRole('button', { name: 'Open terminal here' });
  });

  it('follows the running fix agent after the failure line was left and came back', () => {
    seedFixAgent({ status: 'running' });

    const first = render(actions());
    screen.getByText('An agent is fixing the push');
    first.unmount();
    render(actions());

    screen.getByText('An agent is fixing the push');
    screen.getByRole('button', { name: 'Open the agent' });
    expect(screen.queryByRole('button', { name: 'Let an agent fix the push' })).toBeNull();
  });

  it('says why the agent stopped and offers another try', () => {
    seedFixAgent({ status: 'failed' });
    store.setState({
      pushFixOutcomes: {
        [MOUNT_TARGET.mountId]: outcome({
          kind: 'agent_failed',
          reason: 'The agent was stopped before it finished.',
        }),
      },
    });

    render(actions());

    expect(screen.getByRole('alert').textContent).toBe('The agent was stopped before it finished.');
    screen.getByRole('button', { name: 'Let an agent fix the push' });
  });

  it('clears the failure once the fix pushed while the line was not on screen', () => {
    const onResolved = vi.fn();
    store.setState({ pushFixOutcomes: { [MOUNT_TARGET.mountId]: outcome({}) } });

    render(actions({ onResolved }));

    expect(onResolved).toHaveBeenCalledOnce();
  });

  it('offers to reinstall stale dependencies and retries the push after it', async () => {
    world.check = { ...READY, state: 'missing' };
    const onRetry = vi.fn();
    store.setState({
      runDiscoveredScript: vi.fn(async () => {
        world.check = { ...READY };
        return { stdout: '', stderr: '', exitCode: 0 };
      }),
    });
    render(actions({ onRetry }));

    fireEvent.click(await screen.findByRole('button', { name: 'Reinstall dependencies' }));

    await waitFor(() => expect(onRetry).toHaveBeenCalledOnce());
  });

  it('starts the fix with the failure output', async () => {
    const fixBranchPushWithAgent = vi.fn(async (_input: unknown) => undefined);
    store.setState({ fixBranchPushWithAgent });
    render(actions());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Let an agent fix the push' }));
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
