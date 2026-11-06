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
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
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
}>;

const seedLive = ({ cancel }: SeedParams) => {
  const cancelTurnConfirmed = vi.fn(cancel);
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
      reason: 'user',
    });
    expect(screen.queryByRole('dialog', { name: /did not stop/ })).toBeNull();
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
