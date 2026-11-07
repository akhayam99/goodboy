// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { CancelOutcome } from '../../../../store/slices/turn/cancelTurnConfirmed';
import { handleWindowCloseRequest } from '../../window';
import { WindowCloseSheet } from '.';

const AT = brandId<IsoDateTime>({ value: '2026-11-06T09:00:00.000Z' });

const session = aSession({ goal: 'Retry the notify-relay webhook' });
const first = anAgent({ sessionId: session.id, status: 'running' });
const second = anAgent({ sessionId: session.id, status: 'running' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = Readonly<{
  cancel: () => Promise<CancelOutcome>;
  liveRuns?: ReadonlyArray<string>;
}>;

const seedLive = ({ cancel, liveRuns = ['run-first', 'run-second'] }: SeedParams) => {
  const cancelTurnConfirmed = vi.fn(cancel);
  stubStoryInvoke({ turn_list_live: liveRuns });
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [first, second] },
    agentTurnState: {
      [first.id]: {
        kind: 'running',
        runId: brandId<ProviderRunId>({ value: 'run-first' }),
        startedAt: AT,
      },
      [second.id]: {
        kind: 'blocked',
        runId: brandId<ProviderRunId>({ value: 'run-second' }),
        blockedAt: AT,
      },
    },
    cancelTurnConfirmed,
  });
  return { cancelTurnConfirmed };
};

const requestClose = async () => {
  const preventDefault = vi.fn();
  await act(async () => {
    await handleWindowCloseRequest({ event: { preventDefault } });
  });
  return { preventDefault };
};

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the window close sheet', () => {
  it('stays away when nothing is live, so the window just closes', async () => {
    render(<WindowCloseSheet />);

    await requestClose();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks once when agents are live, counting a permission wait too', async () => {
    seedLive({ cancel: async () => ({ outcome: 'exited', exitedAt: AT }) });
    render(<WindowCloseSheet />);

    await requestClose();

    const sheet = within(
      screen.getByRole('dialog', { name: '2 agents still working in this window' }),
    );
    sheet.getByRole('button', { name: 'Stop 2 agents' });
  });

  it('Cancel keeps the window and every agent running', async () => {
    const { cancelTurnConfirmed } = seedLive({
      cancel: async () => ({ outcome: 'exited', exitedAt: AT }),
    });
    render(<WindowCloseSheet />);
    await requestClose();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cancelTurnConfirmed).not.toHaveBeenCalled();
  });

  it('Stop 2 agents stops each one as stopped by you before the window goes', async () => {
    const { cancelTurnConfirmed } = seedLive({
      cancel: async () => ({ outcome: 'exited', exitedAt: AT }),
    });
    render(<WindowCloseSheet />);
    await requestClose();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop 2 agents' }));
    });

    expect(cancelTurnConfirmed).toHaveBeenCalledTimes(2);
    expect(cancelTurnConfirmed).toHaveBeenCalledWith({
      sessionId: session.id,
      agentId: first.id,
      reason: 'leave',
    });
    expect(screen.queryByRole('dialog', { name: /did not stop/ })).toBeNull();
  });

  it('counts only what the press stops, and keeps a permission ask whose run ended', async () => {
    const { cancelTurnConfirmed } = seedLive({
      cancel: async () => ({ outcome: 'exited', exitedAt: AT }),
      liveRuns: ['run-first'],
    });
    render(<WindowCloseSheet />);
    await requestClose();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop 1 agent' }));
    });

    expect(cancelTurnConfirmed).toHaveBeenCalledTimes(1);
    expect(cancelTurnConfirmed).toHaveBeenCalledWith({
      sessionId: session.id,
      agentId: first.id,
      reason: 'leave',
    });
    expect(screen.queryByRole('dialog', { name: /did not stop/ })).toBeNull();
  });

  it('closes without asking when the only live agent is an ask whose run ended', async () => {
    seedLive({ cancel: async () => ({ outcome: 'exited', exitedAt: AT }), liveRuns: [] });
    useAppStore.setState({
      sessionPhaseRuns: { [session.id]: [{ ...second, status: 'pending' }] },
      agentTurnState: {
        [second.id]: {
          kind: 'blocked',
          runId: brandId<ProviderRunId>({ value: 'run-second' }),
          blockedAt: AT,
        },
      },
    });
    render(<WindowCloseSheet />);

    await requestClose();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('counts every agent when the live list cannot be read', async () => {
    seedLive({ cancel: async () => ({ outcome: 'exited', exitedAt: AT }) });
    stubStoryInvoke({ turn_list_live: () => Promise.reject(new Error('the app is busy')) });
    render(<WindowCloseSheet />);

    await requestClose();

    screen.getByRole('button', { name: 'Stop 2 agents' });
  });

  it('counts a run that is deciding, with no agent running', async () => {
    const run = aWorkflowRun();
    const stopWorkflowRunNow = vi.fn(async () => 'stopped' as const);
    useAppStore.setState({
      sessions: [{ ...session, workflowRuns: [run] }],
      orchestratingWorkflowRuns: { [run.id]: true },
      stopWorkflowRunNow,
    });
    render(<WindowCloseSheet />);

    await requestClose();

    const sheet = within(
      screen.getByRole('dialog', { name: '1 run still working in this window' }),
    );
    await act(async () => {
      fireEvent.click(sheet.getByRole('button', { name: 'Stop 1 run' }));
    });
    expect(stopWorkflowRunNow).toHaveBeenCalledWith(session.id, run.id);
  });

  it('counts an agent and a deciding run together', async () => {
    const { cancelTurnConfirmed } = seedLive({
      cancel: async () => ({ outcome: 'exited', exitedAt: AT }),
    });
    const run = aWorkflowRun();
    useAppStore.setState({
      sessions: [{ ...session, workflowRuns: [run] }],
      orchestratingWorkflowRuns: { [run.id]: true },
      stopWorkflowRunNow: vi.fn(async () => 'stopped' as const),
    });
    render(<WindowCloseSheet />);

    await requestClose();

    screen.getByRole('button', { name: 'Stop 2 agents and 1 run' });
    expect(cancelTurnConfirmed).not.toHaveBeenCalled();
  });

  it('counts a session still running with no agent loaded, which the press also stops', async () => {
    const runId = brandId<ProviderRunId>({ value: 'run-orphan' });
    useAppStore.setState({
      sessions: [{ ...session, state: { kind: 'running', runId, startedAt: AT } }],
    });
    render(<WindowCloseSheet />);

    await requestClose();

    screen.getByRole('button', { name: 'Stop 1 agent' });
  });

  it('says which agents did not stop and offers Close anyway, never a false stop', async () => {
    seedLive({ cancel: async () => ({ outcome: 'still_running', exitedAt: null }) });
    render(<WindowCloseSheet />);
    await requestClose();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop 2 agents' }));
    });

    const sheet = within(screen.getByRole('dialog', { name: '2 agents did not stop' }));
    sheet.getByRole('button', { name: 'Close anyway' });
  });

  it('hides the main window on macOS instead of asking, so Auto lives on', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh)');
    seedLive({ cancel: async () => ({ outcome: 'exited', exitedAt: AT }) });
    render(<WindowCloseSheet />);

    const { preventDefault } = await requestClose();

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
