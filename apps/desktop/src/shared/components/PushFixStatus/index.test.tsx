// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  FIX_RUN_MOUNT,
  MOUNT_TARGET,
  SESSION,
  seedResolveScene,
} from '../../../app/components/MockScene/scenes/resolveSeed';
import type { PushFixOutcome } from '../../../store/slices/history/types';
import { PushFixAgentAction } from '../PushFixAgentAction';
import { PushFixStatus } from './index';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveScene({ expandedThreadId: null });
});

afterEach(cleanup);

const AGENT_ID = brandId<AgentId>({ value: 'agent-push-fixer' });

type AgentStatus = 'running' | 'completed' | 'failed';

type SeedAgentParams = {
  readonly status: AgentStatus;
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
  isClaimed: true,
  followUp: null,
  ...overrides,
});

const seedOutcome = (value: PushFixOutcome): void =>
  store.setState({ pushFixOutcomes: { [MOUNT_TARGET.mountId]: value } });

const status = (onSettled?: () => void) => (
  <PushFixStatus
    sessionId={SESSION.id}
    mountId={MOUNT_TARGET.mountId}
    {...(onSettled !== undefined && { onSettled })}
  />
);

describe('PushFixStatus after the card was left and came back', () => {
  it('shows nothing when no fix ever ran on that branch', () => {
    const { container } = render(status());

    expect(container.textContent).toBe('');
  });

  it('finds the running agent again from the saved agents, as after a window reload', () => {
    seedFixAgent({ status: 'running' });

    const first = render(status());
    screen.getByText('An agent is fixing the push');
    first.unmount();
    render(status());

    screen.getByText('An agent is fixing the push');
    screen.getByRole('button', { name: 'Open the agent' });
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('opens the fix agent of that branch', () => {
    seedFixAgent({ status: 'running' });
    const navigate = vi.fn();
    store.setState({ navigate });
    render(status());

    fireEvent.click(screen.getByRole('button', { name: 'Open the agent' }));

    expect(navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({ agentId: AGENT_ID, sessionId: SESSION.id }),
    });
  });

  it('shows the pushed fix and what the waiting action did, then lets you dismiss it', () => {
    seedFixAgent({ status: 'completed' });
    seedOutcome(outcome({ followUp: { tone: 'done', sentence: 'Pull request #318 is open.' } }));

    const first = render(status());
    first.unmount();
    render(status());

    screen.getByText("The agent's fix is pushed. Pull request #318 is open.");
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(store.getState().pushFixOutcomes[MOUNT_TARGET.mountId]).toBeUndefined();
    expect(screen.queryByText(/The agent's fix is pushed/)).toBeNull();
  });

  it('says the agent did not finish and why', () => {
    seedFixAgent({ status: 'failed' });
    seedOutcome(
      outcome({ kind: 'agent_failed', reason: 'The agent was stopped before it finished.' }),
    );

    render(status());

    expect(screen.getByRole('alert').textContent).toBe('The agent was stopped before it finished.');
  });

  it('says which check stopped the push after the fix', () => {
    seedOutcome(outcome({ kind: 'push_failed', reason: 'pre-push: yarn knip --cache failed' }));

    render(status());

    expect(screen.getByRole('alert').textContent).toBe(
      "The fix couldn't be pushed: pre-push: yarn knip --cache failed.",
    );
  });

  it('reports a failed follow up as an alert', () => {
    seedOutcome(
      outcome({ followUp: { tone: 'failed', sentence: 'The pull request was not created.' } }),
    );

    render(status());

    expect(screen.getByRole('alert').textContent).toBe(
      "The agent's fix is pushed. The pull request was not created.",
    );
  });

  it('resumes the waiting action once when the fix pushed while the card was gone', async () => {
    const onSettled = vi.fn(async () => ({
      tone: 'done' as const,
      sentence: 'Nothing else is waiting.',
    }));
    seedOutcome(outcome({ isClaimed: false }));

    const first = render(status(onSettled));
    await act(async () => undefined);
    first.unmount();
    render(status(onSettled));
    await act(async () => undefined);

    expect(onSettled).toHaveBeenCalledOnce();
    expect(store.getState().pushFixOutcomes[MOUNT_TARGET.mountId]?.isClaimed).toBe(true);
    expect(store.getState().pushFixOutcomes[MOUNT_TARGET.mountId]?.followUp).toEqual({
      tone: 'done',
      sentence: 'Nothing else is waiting.',
    });
    screen.getByText("The agent's fix is pushed. Nothing else is waiting.");
  });
});

describe('the push fix across a leave and return, through the real store', () => {
  it('shows the agent working, then the pushed fix, on a card mounted after the agent settled', async () => {
    seedFixAgent({ status: 'running' });
    store.setState({
      branchPushFixes: {
        [AGENT_ID]: {
          agentId: AGENT_ID,
          sessionId: SESSION.id,
          mountId: MOUNT_TARGET.mountId,
          identity: {
            worktreePath: FIX_RUN_MOUNT.worktreePath,
            branch: FIX_RUN_MOUNT.branch,
            projectId: FIX_RUN_MOUNT.projectId,
          },
          isForce: false,
          confirmedOnlyOnline: null,
          confirmedRemoteSha: null,
          startedAt: 1,
        },
      },
      sessionProjectMounts: { [SESSION.id]: [FIX_RUN_MOUNT] },
      pushBranch: vi.fn(async () => ({ ok: true as const })),
      reportError: vi.fn(async () => undefined),
    });
    const onSettled = vi.fn();

    const card = render(
      <PushFixAgentAction
        sessionId={SESSION.id}
        mountId={MOUNT_TARGET.mountId}
        output="boom"
        onSettled={onSettled}
      />,
    );
    screen.getByText('An agent is fixing the push');
    card.unmount();

    seedFixAgent({ status: 'completed' });
    await act(async () => {
      await store.getState().settleBranchPushFix({
        sessionId: SESSION.id,
        agentId: AGENT_ID,
        hasFailed: false,
      });
    });
    expect(onSettled).not.toHaveBeenCalled();
    expect(store.getState().pushFixOutcomes[MOUNT_TARGET.mountId]?.isClaimed).toBe(false);

    render(status());

    screen.getByText("The agent's fix is pushed.");
  });

  it('shows why the agent stopped on a card mounted after it was stopped', async () => {
    seedFixAgent({ status: 'running' });
    store.setState({
      branchPushFixes: {
        [AGENT_ID]: {
          agentId: AGENT_ID,
          sessionId: SESSION.id,
          mountId: MOUNT_TARGET.mountId,
          identity: {
            worktreePath: FIX_RUN_MOUNT.worktreePath,
            branch: FIX_RUN_MOUNT.branch,
            projectId: FIX_RUN_MOUNT.projectId,
          },
          isForce: false,
          confirmedOnlyOnline: null,
          confirmedRemoteSha: null,
          startedAt: 1,
        },
      },
      sessionProjectMounts: { [SESSION.id]: [FIX_RUN_MOUNT] },
      reportError: vi.fn(async () => undefined),
    });

    seedFixAgent({ status: 'failed' });
    await act(async () => {
      await store.getState().settleBranchPushFix({
        sessionId: SESSION.id,
        agentId: AGENT_ID,
        hasFailed: true,
        reason: 'The provider is offline.',
      });
    });
    render(
      <PushFixAgentAction
        sessionId={SESSION.id}
        mountId={MOUNT_TARGET.mountId}
        output="boom"
        onSettled={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toBe('The provider is offline.');
    screen.getByRole('button', { name: 'Let an agent fix the push' });
  });
});
