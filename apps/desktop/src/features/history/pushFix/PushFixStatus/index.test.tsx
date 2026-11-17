// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  FIX_RUN_MOUNT,
  MOUNT_TARGET,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import type { PushFixOutcome } from '../../../../store/slices/history/types';
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

type AgentStatus = 'running' | 'completed' | 'failed' | 'stopped';

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

const seedTrackedFix = (): void =>
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

const workLine = (): HTMLElement => {
  const line = document.querySelector<HTMLElement>('[data-item-work]');
  if (line === null) {
    throw new Error('No work line');
  }
  return line;
};

describe('PushFixStatus after the card was left and came back', () => {
  it('shows nothing when no fix ever ran on that branch', () => {
    const { container } = render(status());

    expect(container.textContent).toBe('');
  });

  it('finds the running agent again from the saved agents, as after a window reload', () => {
    seedFixAgent({ status: 'running' });

    const first = render(status());
    expect(workLine().dataset.itemWorkState).toBe('fixing');
    first.unmount();
    render(status());

    within(screen.getByRole('status')).getByText('Fixing');
    screen.getByRole('button', { name: 'Stop' });
    screen.getByRole('button', { name: 'Open transcript' });
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('opens the transcript of the fix agent of that branch', () => {
    seedFixAgent({ status: 'running' });
    const openDrawer = vi.fn();
    store.setState({ openDrawer });
    render(status());

    fireEvent.click(screen.getByRole('button', { name: 'Open transcript' }));

    expect(openDrawer).toHaveBeenCalledWith({
      kind: 'transcript',
      sessionId: SESSION.id,
      payload: { agentId: AGENT_ID },
    });
  });

  it('stops the fix agent from the card', () => {
    seedFixAgent({ status: 'running' });
    const cancelCurrentTurn = vi.fn(async () => undefined);
    store.setState({ cancelCurrentTurn });
    render(status());

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(cancelCurrentTurn).toHaveBeenCalledWith(SESSION.id, AGENT_ID, 'user');
  });

  it('shows the pushed fix and what the waiting action did, then lets you dismiss it', () => {
    seedFixAgent({ status: 'completed' });
    seedOutcome(outcome({ followUp: { tone: 'done', sentence: 'Pull request #318 is open.' } }));

    const first = render(status());
    first.unmount();
    render(status());

    const line = screen.getByRole('status');
    within(line).getByText('Pushed');
    within(line).getByText('Pull request #318 is open.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(store.getState().pushFixOutcomes[MOUNT_TARGET.mountId]).toBeUndefined();
    expect(screen.queryByText('Pushed')).toBeNull();
  });

  it('says the agent failed and why', () => {
    seedFixAgent({ status: 'failed' });
    seedOutcome(outcome({ kind: 'agent_failed', reason: 'The provider is offline.' }));

    render(status());

    const alert = screen.getByRole('alert');
    within(alert).getByText('Failed');
    within(alert).getByText('The provider is offline.');
  });

  it('says a fix you stopped is stopped, with what stays on the branch', () => {
    seedFixAgent({ status: 'stopped' });
    seedOutcome(
      outcome({ kind: 'agent_stopped', reason: 'The agent was stopped before it finished.' }),
    );

    render(status());

    const line = screen.getByRole('status');
    within(line).getByText('Stopped');
    within(line).getByText('Nothing was pushed; its edits stay on the branch.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says which check stopped the push after the fix', () => {
    seedOutcome(outcome({ kind: 'push_failed', reason: 'pre-push: yarn knip --cache failed' }));

    render(status());

    within(screen.getByRole('alert')).getByText(
      "The fix couldn't be pushed: pre-push: yarn knip --cache failed.",
    );
  });

  it('reports a failed follow up as an alert', () => {
    seedOutcome(
      outcome({ followUp: { tone: 'failed', sentence: 'The pull request was not created.' } }),
    );

    render(status());

    within(screen.getByRole('alert')).getByText(
      'The fix is pushed. The pull request was not created.',
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
    screen.getByText('Nothing else is waiting.');
  });
});

describe('the claim on a pushed fix while the waiting action continues', () => {
  it('releases the claim, reports the failure and tries again when the card comes back', async () => {
    const reportError = vi.fn(async () => undefined);
    store.setState({ reportError });
    seedOutcome(outcome({ isClaimed: false }));
    const onSettled = vi
      .fn<() => Promise<{ readonly tone: 'done'; readonly sentence: string } | undefined>>()
      .mockRejectedValueOnce(new Error('The form is gone'))
      .mockResolvedValueOnce({ tone: 'done', sentence: 'Nothing else is waiting.' });

    const first = render(status(onSettled));
    await act(async () => undefined);

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't continue after the fix." }),
    );
    expect(store.getState().pushFixOutcomes[MOUNT_TARGET.mountId]?.isClaimed).toBe(false);
    expect(store.getState().pushFixClaims[MOUNT_TARGET.mountId]).toBeUndefined();
    first.unmount();
    render(status(onSettled));
    await act(async () => undefined);

    expect(onSettled).toHaveBeenCalledTimes(2);
    expect(store.getState().pushFixOutcomes[MOUNT_TARGET.mountId]).toMatchObject({
      isClaimed: true,
      followUp: { tone: 'done', sentence: 'Nothing else is waiting.' },
    });
  });

  it('holds the claim in memory while it runs, so a reload mid-flight resumes it again', async () => {
    seedOutcome(outcome({ isClaimed: false }));
    let finish: (value: undefined) => void = () => undefined;
    const pending = new Promise<undefined>((resolve) => {
      finish = resolve;
    });
    const interrupted = vi.fn(() => pending);

    render(status(interrupted));
    await act(async () => undefined);

    expect(store.getState().pushFixClaims[MOUNT_TARGET.mountId]).toBe(AGENT_ID);
    expect(store.getState().pushFixOutcomes[MOUNT_TARGET.mountId]?.isClaimed).toBe(false);

    cleanup();
    store.setState({ pushFixClaims: {} });
    const resumed = vi.fn(async () => undefined);
    render(status(resumed));
    await act(async () => undefined);

    expect(resumed).toHaveBeenCalledOnce();
    expect(store.getState().pushFixOutcomes[MOUNT_TARGET.mountId]?.isClaimed).toBe(true);
    await act(async () => finish(undefined));
  });

  it('does not run the continuation twice while the first one is still in flight', async () => {
    seedOutcome(outcome({ isClaimed: false }));
    const onSettled = vi.fn(() => new Promise<undefined>(() => undefined));

    render(status(onSettled));
    render(status(onSettled));
    await act(async () => undefined);

    expect(onSettled).toHaveBeenCalledOnce();
  });
});

describe('the push fix across a leave and return, through the real store', () => {
  it('shows the agent working, then the pushed fix, on a card mounted after the agent settled', async () => {
    seedFixAgent({ status: 'running' });
    seedTrackedFix();
    store.setState({ pushBranch: vi.fn(async () => ({ ok: true as const })) });
    const onSettled = vi.fn();

    const card = render(
      <PushFixAgentAction
        sessionId={SESSION.id}
        mountId={MOUNT_TARGET.mountId}
        output="boom"
        onSettled={onSettled}
      />,
    );
    within(screen.getByRole('status')).getByText('Fixing');
    expect(screen.queryByRole('button', { name: 'Fix with an agent' })).toBeNull();
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

    within(screen.getByRole('status')).getByText('Pushed');
  });

  it('shows why the agent failed on a card mounted after it settled, with Retry', async () => {
    seedFixAgent({ status: 'running' });
    seedTrackedFix();

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

    within(screen.getByRole('alert')).getByText('The provider is offline.');
    screen.getByRole('button', { name: 'Retry' });
    expect(screen.queryByRole('button', { name: 'Fix with an agent' })).toBeNull();
  });

  it('retries a stopped fix with a new agent from the same card', async () => {
    seedFixAgent({ status: 'running' });
    seedTrackedFix();
    seedFixAgent({ status: 'stopped' });
    await act(async () => {
      await store.getState().settleBranchPushFix({
        sessionId: SESSION.id,
        agentId: AGENT_ID,
        hasFailed: true,
        wasStopped: true,
        reason: 'The agent was stopped before it finished.',
      });
    });
    const fixBranchPushWithAgent = vi.fn(async () => undefined);
    store.setState({ fixBranchPushWithAgent });
    render(
      <PushFixAgentAction
        sessionId={SESSION.id}
        mountId={MOUNT_TARGET.mountId}
        output="boom"
        onSettled={vi.fn()}
      />,
    );

    within(screen.getByRole('status')).getByText('Stopped');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(fixBranchPushWithAgent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION.id, mountId: MOUNT_TARGET.mountId }),
    );
  });
});
